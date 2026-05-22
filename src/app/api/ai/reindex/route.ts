import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { enrichWithEmbedding } from "@/lib/memberService";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 400 }
      );
    }

    await connectDB();
    const docs = await TeamMemberModel.find();
    let indexed = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      try {
        const plain = docToPlain(doc);
        const emb = await enrichWithEmbedding(plain);
        doc.embedding = emb.embedding;
        doc.embeddingText = emb.embeddingText;
        await doc.save();
        indexed++;
      } catch (err) {
        errors.push(`${doc.id}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    return NextResponse.json({ indexed, total: docs.length, errors });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reindex failed" },
      { status: 500 }
    );
  }
}
