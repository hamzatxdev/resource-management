import type { HydratedDocument } from "mongoose";
import type { AssessField } from "./assessFields";
import { detectStacks } from "./categorize";
import { applyBulkOverrides } from "./inferRatings";
import { enrichMember, enrichWithEmbedding } from "./memberService";
import { aiFlagForDb } from "./persistFlag";
import { primarySpecialization } from "./specializations";
import { appendWorkflowEntry } from "./workflow";
import type { TeamMemberMongoose } from "@/models/TeamMember";
import type { AiFlag } from "./types";

type MemberDoc = HydratedDocument<TeamMemberMongoose>;

export type AssessmentResult = {
  specializations?: string[];
  stackLabel?: string;
  ratingUpdates?: Record<string, number>;
  clearOverrides?: string[];
  flag?: AiFlag;
  suggestedNextSteps?: string;
  summary?: string;
};

export async function applyAssessmentToMember(
  doc: MemberDoc,
  fields: AssessField[],
  result: AssessmentResult,
  redoFields: AssessField[] = []
) {
  if (
    fields.includes("skillRatings") &&
    redoFields.includes("skillRatings")
  ) {
    doc.ratingOverrides = {};
  }
  if (fields.includes("specializations") && result.specializations?.length) {
    doc.specializations = result.specializations;
    doc.specialization = primarySpecialization(result.specializations);
  }

  if (fields.includes("stacks") && result.stackLabel?.trim()) {
    doc.stackLabel = result.stackLabel.trim();
    doc.stacks = detectStacks(doc.skills);
  }

  if (fields.includes("skillRatings")) {
    const ai = { ...(doc.aiRatings ?? {}) } as Record<string, number>;
    let overrides = { ...(doc.ratingOverrides ?? {}) } as Record<string, number>;

    for (const skill of result.clearOverrides ?? []) {
      delete overrides[skill];
    }

    const ratingUpdates: Record<string, number | null> = {};
    for (const [skill, value] of Object.entries(result.ratingUpdates ?? {})) {
      const match = doc.skills.find(
        (s: string) => s.toLowerCase() === skill.toLowerCase()
      );
      if (match) {
        ai[match] = value;
        ratingUpdates[match] = value;
      }
    }

    doc.aiRatings = ai;
    doc.ratingOverrides = applyBulkOverrides(ai, overrides, ratingUpdates);
    doc.markModified("aiRatings");
    doc.markModified("ratingOverrides");
  }

  if (fields.includes("flags")) {
    if (!result.flag) {
      throw new Error("Assessment missing flag payload");
    }
    doc.set("aiFlags", aiFlagForDb(result.flag, { stampReview: true }));
    doc.markModified("aiFlags");
  }

  if (fields.includes("nextSteps") && result.suggestedNextSteps?.trim()) {
    const text = result.suggestedNextSteps.trim();
    doc.nextSteps = text;
    doc.set("nextStepsLog", appendWorkflowEntry(doc.nextStepsLog, text));
  }

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
    notes: doc.notes,
    specializations: (doc.specializations as string[]) ?? [],
  };

  if (
    fields.includes("specializations") &&
    !fields.includes("skillRatings")
  ) {
    const enriched = enrichMember(input);
    doc.aiRatings = enriched.aiRatings;
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const emb = await enrichWithEmbedding({
        ...input,
        specialization: doc.specialization,
        specializations: doc.specializations as string[],
        stacks: (doc.stacks as string[]) ?? [],
        aiRatings: { ...(doc.aiRatings ?? {}) } as Record<string, number>,
        aiFlags: normalizeFlag(doc.aiFlags),
        nextSteps: doc.nextSteps,
      });
      doc.embedding = emb.embedding;
      doc.embeddingText = emb.embeddingText;
    } catch {
      /* optional */
    }
  }

  await doc.save();
}

function normalizeFlag(raw: unknown): AiFlag {
  const f = raw as AiFlag | undefined;
  return (
    f ?? {
      flagged: false,
      severity: "none",
      reasons: [],
      summary: "",
    }
  );
}
