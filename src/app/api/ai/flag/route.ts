import OpenAI from "openai";
import { NextResponse } from "next/server";
import { assessProfileFlags } from "@/lib/flagAssessment";
import { connectDB } from "@/lib/mongodb";
import { saveAiFlagOnMember } from "@/lib/persistFlag";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";
async function flagOne(
  openai: OpenAI,
  member: ReturnType<typeof toClientMember>
) {
  return assessProfileFlags(openai, member);
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 400 });
    }

    const body = (await req.json()) as { id?: string; all?: boolean };
    await connectDB();
    const openai = new OpenAI({ apiKey: key });

    if (body.all) {
      const docs = await TeamMemberModel.find().lean();
      const results: Array<{ id: string; flagged: boolean; severity: string }> =
        [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const d of docs) {
        const plain = docToPlain(d);
        const member = toClientMember(plain);
        try {
          const { flag, suggestedNextSteps } = await flagOne(openai, member);
          const doc = await TeamMemberModel.findOne({ id: member.id });
          if (doc) {
            await saveAiFlagOnMember(doc, flag, { suggestedNextSteps });
          }
          results.push({
            id: member.id,
            flagged: flag.flagged,
            severity: flag.severity,
          });
        } catch (err) {
          errors.push({
            id: member.id,
            error: err instanceof Error ? err.message : "Flag failed",
          });
        }
      }

      return NextResponse.json({
        results,
        count: results.length,
        failed: errors.length,
        errors,
      });
    }

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id or all:true required" }, { status: 400 });
    }

    const doc = await TeamMemberModel.findOne({ id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const member = toClientMember(docToPlain(doc));
    const { flag, suggestedNextSteps } = await flagOne(openai, member);

    await saveAiFlagOnMember(doc, flag, { suggestedNextSteps });

    const fresh = await TeamMemberModel.findOne({ id }).lean();
    if (!fresh) {
      return NextResponse.json({ error: "Not found after save" }, { status: 500 });
    }

    return NextResponse.json({
      member: toClientMember(docToPlain(fresh)),
      flag,
      suggestedNextSteps,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Flag failed" },
      { status: 500 }
    );
  }
}
