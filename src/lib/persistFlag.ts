import type { HydratedDocument } from "mongoose";
import { enrichWithEmbedding } from "./memberService";
import { appendWorkflowEntry } from "./workflow";
import type { TeamMemberMongoose } from "@/models/TeamMember";
import type { AiFlag } from "./types";

type MemberDoc = HydratedDocument<TeamMemberMongoose>;

export function aiFlagForDb(flag: AiFlag, opts?: { stampReview?: boolean }) {
  const reviewed =
    flag.flaggedAt != null
      ? new Date(flag.flaggedAt)
      : opts?.stampReview
        ? new Date()
        : undefined;
  return {
    flagged: Boolean(flag.flagged),
    severity: flag.flagged ? flag.severity : "none",
    summary: flag.summary ?? "",
    reasons: Array.isArray(flag.reasons) ? flag.reasons : [],
    flaggedAt: reviewed,
  };
}

export async function applySuggestedNextSteps(
  doc: MemberDoc,
  suggestedNextSteps?: string
) {
  const text = suggestedNextSteps?.trim();
  if (!text || doc.nextSteps) return;

  doc.nextSteps = text;
  doc.set("nextStepsLog", appendWorkflowEntry(doc.nextStepsLog, text));
}

export async function saveAiFlagOnMember(
  doc: MemberDoc,
  flag: AiFlag,
  opts?: { suggestedNextSteps?: string; reindex?: boolean }
) {
  doc.set("aiFlags", aiFlagForDb(flag, { stampReview: true }));
  doc.markModified("aiFlags");

  await applySuggestedNextSteps(doc, opts?.suggestedNextSteps);

  if (opts?.reindex !== false && process.env.OPENAI_API_KEY) {
    try {
      const emb = await enrichWithEmbedding({
        id: doc.id,
        name: doc.name,
        role: doc.role,
        exp: doc.exp,
        skills: doc.skills,
        tags: doc.tags ?? [],
        notes: doc.notes,
        stackLabel: doc.stackLabel ?? "",
        projects: doc.projects ?? [],
        specialization: doc.specialization,
        specializations: (doc.specializations as string[]) ?? [
          doc.specialization,
        ],
        stacks: (doc.stacks as string[]) ?? [],
        aiRatings: { ...(doc.aiRatings ?? {}) } as Record<string, number>,
        aiFlags: flag,
        nextSteps: doc.nextSteps,
      });
      doc.embedding = emb.embedding;
      doc.embeddingText = emb.embeddingText;
      doc.markModified("embedding");
    } catch {
      /* embedding optional */
    }
  }

  await doc.save();
}
