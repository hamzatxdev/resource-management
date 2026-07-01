import type OpenAI from "openai";
import type { HydratedDocument } from "mongoose";
import { z } from "zod";
import { detectStacks } from "./categorize";
import { buildProfilePayloadForAI, profilePayloadText } from "./aiProfile";
import { SUGGEST_SKILLS_SYSTEM } from "./aiPrompts";
import { inferSkillRatings } from "./inferRatings";
import { enrichWithEmbedding } from "./memberService";
import { mergeSkills } from "./skills";
import type { TeamMemberClient } from "./types";
import type { TeamMemberMongoose } from "@/models/TeamMember";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const SuggestSchema = z.object({
  skills: z.array(z.string()),
  ratingUpdates: z.record(z.number()).optional(),
  summary: z.string().optional(),
});

export type SuggestedSkillsResult = {
  skills: string[];
  ratingUpdates: Record<string, number>;
  summary: string;
};

type MemberDoc = HydratedDocument<TeamMemberMongoose>;

function clampRating(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n * 2) / 2));
}

function findRating(
  map: Record<string, number> | undefined,
  skill: string
): number | undefined {
  if (!map) return undefined;
  if (map[skill] != null) return map[skill];
  const lower = skill.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

export function filterNewSkills(
  existing: string[],
  suggested: string[]
): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const out: string[] = [];
  const added = new Set<string>();
  for (const raw of suggested) {
    const skill = raw.trim();
    if (!skill) continue;
    const lower = skill.toLowerCase();
    if (seen.has(lower) || added.has(lower)) continue;
    added.add(lower);
    out.push(skill);
  }
  return out;
}

export async function suggestSkillsForProfile(
  openai: OpenAI,
  member: TeamMemberClient,
  opts?: { maxSkills?: number }
): Promise<SuggestedSkillsResult> {
  const maxSkills = opts?.maxSkills ?? 25;
  const payload = {
    ...buildProfilePayloadForAI(member),
    existingSkills: member.skills,
  };

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SUGGEST_SKILLS_SYSTEM },
      {
        role: "user",
        content: `Suggest up to ${maxSkills} new skills for this profile.\n\n${profilePayloadText(payload)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = SuggestSchema.parse(JSON.parse(raw));
  const skills = filterNewSkills(member.skills, parsed.skills).slice(0, maxSkills);

  const ratingUpdates: Record<string, number> = {};
  for (const skill of skills) {
    const rating = findRating(parsed.ratingUpdates, skill);
    if (rating != null) ratingUpdates[skill] = clampRating(rating);
  }

  return {
    skills,
    ratingUpdates,
    summary: parsed.summary?.trim() ?? "",
  };
}

export async function applySuggestedSkillsToDoc(
  doc: MemberDoc,
  skills: string[],
  ratingUpdates: Record<string, number>
): Promise<string[]> {
  const before = new Set(doc.skills.map((s) => s.toLowerCase()));
  doc.skills = mergeSkills(doc.skills, skills);
  const added = skills.filter((s) => !before.has(s.toLowerCase()));
  if (!added.length) return [];

  const inferred = inferSkillRatings({
    role: doc.role,
    expNum: doc.expNum,
    skills: doc.skills,
    specializations: (doc.specializations as string[]) ?? [],
  });

  const ai = { ...(doc.aiRatings ?? {}) } as Record<string, number>;
  for (const skill of added) {
    const fromAi = ratingUpdates[skill] ?? findRating(ratingUpdates, skill);
    ai[skill] =
      fromAi != null ? clampRating(fromAi) : (inferred[skill] ?? 3);
  }

  doc.aiRatings = ai;
  doc.stacks = detectStacks(doc.skills);
  doc.markModified("aiRatings");
  doc.markModified("stacks");

  if (process.env.OPENAI_API_KEY) {
    try {
      const emb = await enrichWithEmbedding({
        id: doc.id,
        name: doc.name,
        role: doc.role,
        exp: doc.exp,
        skills: doc.skills,
        stackLabel: doc.stackLabel,
        tags: doc.tags,
        projects: doc.projects,
        notes: doc.notes,
        specializations: (doc.specializations as string[]) ?? [],
        specialization: doc.specialization,
        stacks: (doc.stacks as string[]) ?? [],
        aiRatings: ai,
        aiFlags: doc.aiFlags as TeamMemberClient["aiFlags"],
        nextSteps: doc.nextSteps,
      });
      doc.embedding = emb.embedding;
      doc.embeddingText = emb.embeddingText;
    } catch {
      /* optional */
    }
  }

  await doc.save();
  return added;
}
