import { detectStacks } from "./categorize";
import {
  detectGranularSpecializations,
  mergeSpecializations,
  primarySpecialization,
} from "./specializations";
import { buildEmbeddingText, embedText } from "./embeddings";
import { inferSkillRatings } from "./inferRatings";
import { DEFAULT_AI_FLAG, type TeamMemberDoc, type TeamMemberInput } from "./types";

export type EnrichedMemberFields = Omit<
  TeamMemberDoc,
  "_id" | "embedding" | "embeddingText" | "createdAt" | "updatedAt"
>;

export function enrichMember(input: TeamMemberInput): EnrichedMemberFields {
  const detected = detectGranularSpecializations(input);
  const specializations = mergeSpecializations(
    detected,
    input.specializations ?? []
  );
  const specialization = primarySpecialization(specializations);
  const stacks = detectStacks(input.skills);
  const aiRatings = inferSkillRatings({
    role: input.role,
    expNum: input.expNum,
    skills: input.skills,
    specializations,
  });

  return {
    id: input.id,
    name: input.name,
    role: input.role,
    exp: input.exp,
    expNum: input.expNum,
    skills: input.skills,
    email: input.email,
    stackLabel: input.stackLabel ?? "",
    tags: input.tags ?? [],
    projects: input.projects ?? [],
    notes: input.notes ?? "",
    specialization,
    specializations,
    stacks,
    aiRatings,
    ratingOverrides: {},
    aiFlags: { ...DEFAULT_AI_FLAG },
    nextSteps: input.nextSteps ?? "",
    nextStepsLog: [],
    escalations: [],
  };
}

export async function enrichWithEmbedding(
  member: Parameters<typeof buildEmbeddingText>[0]
): Promise<{ embedding: number[]; embeddingText: string }> {
  const embeddingText = buildEmbeddingText(member);
  const embedding = await embedText(embeddingText);
  return { embedding, embeddingText };
}

export function parseExpNum(exp: string): number {
  const m = exp.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
