import OpenAI from "openai";
import { tagsForAI } from "./tags";
const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export type EmbeddingMember = {
  id: string;
  name: string;
  role: string;
  exp: string;
  skills: string[];
  tags: string[];
  notes?: string;
  stackLabel: string;
  projects: string[];
  specialization: string;
  specializations: string[];
  aiFlags?: { flagged: boolean; severity: string; summary: string; reasons: string[] };
  nextSteps?: string;
  stacks: string[];
  aiRatings: Record<string, number>;
};

export function buildEmbeddingText(member: EmbeddingMember): string {
  const ratedSkills = member.skills
    .map((s) => `${s} (${member.aiRatings[s] ?? "?"}/5)`)
    .join(", ");

  return [
    `ID: ${member.id}`,
    `Name: ${member.name}`,
    `Role: ${member.role}`,
    `Experience: ${member.exp}`,
    `Specializations: ${member.specializations?.join(", ") || member.specialization}`,
    member.aiFlags?.flagged
      ? `AI flag [${member.aiFlags.severity}]: ${member.aiFlags.summary}; ${member.aiFlags.reasons?.join("; ")}`
      : null,
    member.nextSteps ? `Next steps: ${member.nextSteps}` : null,
    `Stacks: ${member.stacks.join(", ")}`,
    `Stack label: ${member.stackLabel}`,
    `Tags (interpreted): ${tagsForAI(member.tags)}`,
    member.notes ? `Profile notes: ${member.notes}` : null,
    `Skills with AI ratings: ${ratedSkills}`,
    `Projects: ${member.projects.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function embedText(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const openai = new OpenAI({ apiKey: key });
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

export function rankByEmbedding<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  members: Array<{ member: T }>,
  topK = 8,
  minScore = 0
): Array<{ member: T; score: number }> {
  return members
    .filter((m) => m.member.embedding?.length)
    .map((m) => ({
      member: m.member,
      score: cosineSimilarity(queryEmbedding, m.member.embedding!),
    }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
