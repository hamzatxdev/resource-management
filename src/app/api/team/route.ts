import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { enrichMember, enrichWithEmbedding } from "@/lib/memberService";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";
import type { TeamMemberInput } from "@/lib/types";

export async function GET() {
  try {
    await connectDB();
    const docs = await TeamMemberModel.find().sort({ name: 1 }).lean();
    const members = docs.map((d) => toClientMember(docToPlain(d)));
    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load team" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = (await req.json()) as TeamMemberInput;
    if (!body.id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await TeamMemberModel.findOne({ id: body.id });
    if (existing) {
      return NextResponse.json({ error: "Member already exists" }, { status: 409 });
    }

    const enriched = enrichMember(body);
    let embedding: number[] | undefined;
    let embeddingText = "";

    if (process.env.OPENAI_API_KEY) {
      try {
        const emb = await enrichWithEmbedding(enriched);
        embedding = emb.embedding;
        embeddingText = emb.embeddingText;
      } catch {
        /* skip embedding if OpenAI unavailable */
      }
    }

    const doc = await TeamMemberModel.create({
      ...enriched,
      embedding,
      embeddingText,
    });

    const plain = docToPlain(doc);
    return NextResponse.json({
      member: toClientMember(plain),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create member" },
      { status: 500 }
    );
  }
}
