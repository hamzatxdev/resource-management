import { NextResponse } from "next/server";
import { excelRowToInput, parseExcelBuffer } from "@/lib/excel";
import { connectDB } from "@/lib/mongodb";
import { enrichMember, enrichWithEmbedding } from "@/lib/memberService";
import { TeamMemberModel } from "@/models/TeamMember";

export async function POST(req: Request) {
  try {
    await connectDB();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseExcelBuffer(buffer);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const input = excelRowToInput(row);
        const enriched = enrichMember(input);
        const existing = await TeamMemberModel.findOne({ id: input.id });

        let embedding: number[] | undefined;
        let embeddingText = existing?.embeddingText ?? "";

        if (process.env.OPENAI_API_KEY) {
          try {
            const emb = await enrichWithEmbedding(enriched);
            embedding = emb.embedding;
            embeddingText = emb.embeddingText;
          } catch {
            /* continue without re-embed */
          }
        }

        if (existing) {
          existing.name = enriched.name;
          existing.role = enriched.role;
          existing.exp = enriched.exp;
          existing.expNum = enriched.expNum;
          existing.skills = enriched.skills;
          existing.email = enriched.email;
          existing.stackLabel = enriched.stackLabel;
          existing.tags = enriched.tags.length ? enriched.tags : existing.tags;
          existing.projects = enriched.projects;
          existing.specialization = enriched.specialization;
          existing.specializations = enriched.specializations;
          existing.stacks = enriched.stacks;
          existing.aiRatings = enriched.aiRatings;
          if (embedding) {
            existing.embedding = embedding;
            existing.embeddingText = embeddingText;
          }
          await existing.save();
          updated++;
        } else {
          await TeamMemberModel.create({
            ...enriched,
            specializations: enriched.specializations,
            embedding,
            embeddingText,
          });
          created++;
        }
      } catch (err) {
        errors.push(`${row.id}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    return NextResponse.json({
      created,
      updated,
      total: rows.length,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
