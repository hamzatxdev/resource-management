import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PROFILE_GENERATION_SYSTEM } from "@/lib/aiPrompts";
import { parseTag } from "@/lib/tags";
import { connectDB } from "@/lib/mongodb";
import { enrichMember, enrichWithEmbedding, parseExpNum } from "@/lib/memberService";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const ProfileSchema = z.object({
  name: z.string(),
  role: z.string(),
  exp: z.string(),
  email: z.string(),
  stackLabel: z.string(),
  skills: z.array(z.string()),
  tags: z.array(z.string()),
  specializations: z.array(z.string()).optional(),
  projects: z.array(z.string()),
  notes: z.string(),
});

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      id: string;
      notes: string;
      save?: boolean;
    };

    const id = body.id?.trim();
    const notes = body.notes?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!notes) {
      return NextResponse.json({ error: "notes are required" }, { status: 400 });
    }

    await connectDB();
    const existingDoc = await TeamMemberModel.findOne({ id }).lean();
    const existing = existingDoc ? docToPlain(existingDoc) : null;
    const existingContext = existing
      ? `Existing record: name=${existing.name}, role=${existing.role}, tags=${existing.tags.join(", ")}`
      : "No existing record — create new profile.";

    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROFILE_GENERATION_SYSTEM },
        {
          role: "user",
          content: `Employee ID: ${id}\n${existingContext}\n\nNotes from manager:\n${notes}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: z.infer<typeof ProfileSchema>;
    try {
      parsed = ProfileSchema.parse(JSON.parse(raw));
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid profile JSON", raw },
        { status: 502 }
      );
    }

    const tagLabels = parsed.tags.map((t) => parseTag(t));

    const profile = {
      id,
      name: parsed.name,
      role: parsed.role,
      exp: parsed.exp,
      expNum: parseExpNum(parsed.exp),
      email: parsed.email,
      stackLabel: parsed.stackLabel,
      skills: parsed.skills,
      tags: parsed.tags,
      specializations: parsed.specializations ?? [],
      projects: parsed.projects,
      notes: parsed.notes || notes,
    };

    if (!body.save) {
      return NextResponse.json({ profile, tagLabels, saved: false });
    }

    const enriched = enrichMember(profile);
    let embedding: number[] | undefined;
    let embeddingText = "";

    try {
      const emb = await enrichWithEmbedding({ ...enriched, notes: profile.notes });
      embedding = emb.embedding;
      embeddingText = emb.embeddingText;
    } catch {
      /* optional */
    }

    let doc = await TeamMemberModel.findOne({ id });
    if (doc) {
      Object.assign(doc, enriched, { notes: profile.notes, embedding, embeddingText });
      await doc.save();
    } else {
      doc = await TeamMemberModel.create({
        ...enriched,
        notes: profile.notes,
        embedding,
        embeddingText,
        ratingOverrides: {},
      });
    }

    return NextResponse.json({
      profile,
      tagLabels,
      saved: true,
      member: toClientMember(docToPlain(doc)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Profile generation failed" },
      { status: 500 }
    );
  }
}
