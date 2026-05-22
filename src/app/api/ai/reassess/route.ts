import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { buildProfilePayloadForAI, profilePayloadText } from "@/lib/aiProfile";
import { REASSESS_SYSTEM } from "@/lib/aiPrompts";
import { connectDB } from "@/lib/mongodb";
import { enrichMember, enrichWithEmbedding } from "@/lib/memberService";
import { applyBulkOverrides } from "@/lib/inferRatings";
import { primarySpecialization } from "@/lib/specializations";
import { appendWorkflowEntry } from "@/lib/workflow";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const ReassessSchema = z.object({
  assessment: z.string(),
  ratingUpdates: z.record(z.number()).optional(),
  clearOverrides: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  suggestedNextSteps: z.string().optional(),
  flag: z
    .object({
      flagged: z.boolean(),
      severity: z.enum([
        "none",
        "ok",
        "info",
        "watch",
        "action",
        "replacement",
      ]),
      summary: z.string(),
      reasons: z.array(z.string()),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 400 });
    }

    const { id, escalationText, escalationId } = (await req.json()) as {
      id: string;
      escalationText?: string;
      escalationId?: string;
    };

    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await connectDB();
    const doc = await TeamMemberModel.findOne({ id: id.trim() });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let escalation = escalationText?.trim() ?? "";
    const escalations = (doc.escalations ?? []) as Array<{
      id: string;
      text: string;
      createdAt: string;
      assessment?: string;
    }>;

    if (!escalation && escalationId) {
      escalation =
        escalations.find((e) => e.id === escalationId)?.text ?? "";
    }
    if (!escalation) {
      const latest = escalations[escalations.length - 1];
      escalation = latest?.text ?? "";
    }
    if (!escalation) {
      return NextResponse.json(
        { error: "escalationText required (or add an escalation first)" },
        { status: 400 }
      );
    }

    const member = toClientMember(docToPlain(doc));
    const payload = buildProfilePayloadForAI(member);

    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REASSESS_SYSTEM },
        {
          role: "user",
          content: `Profile:\n${profilePayloadText(payload)}\n\nNEW ESCALATION:\n${escalation}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = ReassessSchema.parse(JSON.parse(raw));

    const ai = { ...(doc.aiRatings ?? {}) } as Record<string, number>;
    let overrides = { ...(doc.ratingOverrides ?? {}) } as Record<string, number>;

    for (const skill of parsed.clearOverrides ?? []) {
      delete overrides[skill];
    }

    const ratingUpdates: Record<string, number | null> = {};
    for (const [skill, value] of Object.entries(parsed.ratingUpdates ?? {})) {
      const match = doc.skills.find(
        (s: string) => s.toLowerCase() === skill.toLowerCase()
      );
      if (match) ratingUpdates[match] = value;
    }
    overrides = applyBulkOverrides(ai, overrides, ratingUpdates);

    doc.ratingOverrides = overrides;

    if (parsed.specializations?.length) {
      doc.specializations = parsed.specializations;
      doc.specialization = primarySpecialization(parsed.specializations);
    }

    if (parsed.suggestedNextSteps?.trim()) {
      const stepText = parsed.suggestedNextSteps.trim();
      doc.nextSteps = stepText;
      doc.set(
        "nextStepsLog",
        appendWorkflowEntry(doc.nextStepsLog, stepText)
      );
    }

    if (parsed.flag) {
      const { aiFlagForDb } = await import("@/lib/aiFlags");
      doc.set(
        "aiFlags",
        aiFlagForDb(
          {
            flagged: parsed.flag.flagged,
            severity: parsed.flag.severity,
            summary: parsed.flag.summary,
            reasons: parsed.flag.reasons,
          },
          { stampReview: true }
        )
      );
      doc.markModified("aiFlags");
    }

    const entryId = escalationId ?? randomUUID();
    const existingIdx = escalations.findIndex((e) => e.id === entryId);
    const entry = {
      id: entryId,
      text: escalation,
      createdAt:
        existingIdx >= 0
          ? escalations[existingIdx].createdAt
          : new Date().toISOString(),
      assessment: parsed.assessment,
      appliedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      escalations[existingIdx] = entry;
    } else {
      escalations.push(entry);
    }
    doc.escalations = escalations;
    doc.markModified("escalations");
    doc.markModified("ratingOverrides");
    doc.markModified("aiFlags");

    const input = {
      id: doc.id,
      name: doc.name,
      role: doc.role,
      exp: doc.exp,
      expNum: doc.expNum,
      skills: doc.skills,
      email: doc.email,
      stackLabel: doc.stackLabel,
      tags: doc.tags,
      projects: doc.projects,
      notes: `${doc.notes}\n\n[Reassess ${new Date().toISOString().slice(0, 10)}] ${parsed.assessment}`.trim(),
      specializations: doc.specializations,
    };

    const enriched = enrichMember(input);
    doc.aiRatings = enriched.aiRatings;

    if (process.env.OPENAI_API_KEY) {
      try {
        const emb = await enrichWithEmbedding({
          ...enriched,
          notes: doc.notes,
        });
        doc.embedding = emb.embedding;
        doc.embeddingText = emb.embeddingText;
      } catch {
        /* skip */
      }
    }

    await doc.save();

    return NextResponse.json({
      member: toClientMember(docToPlain(doc)),
      assessment: parsed.assessment,
      ratingUpdates: parsed.ratingUpdates,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reassess failed" },
      { status: 500 }
    );
  }
}
