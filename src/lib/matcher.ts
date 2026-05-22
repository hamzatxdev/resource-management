import { normalizeAiFlag } from "./aiFlags";
import { effectiveRatings } from "./inferRatings";
import type { TeamMemberClient } from "./types";

export interface SkillRequirement {
  skill: string;
  minRating: number;
}

export interface MatchResult {
  person: TeamMemberClient;
  normalizedScore: number;
  strengthPct: number;
  met: number;
  partial: number;
  miss: number;
  matched: { req: string; skill: string; rating: number; status: "met" | "partial" | "miss" }[];
}

export function normalizeSkillName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.js$/i, "")
    .replace(/\s+/g, "")
    .trim();
}

export function fuzzyMatchSkill(
  personSkills: string[],
  required: string
): string | null {
  const reqNorm = normalizeSkillName(required);
  for (const s of personSkills) {
    if (s.toLowerCase() === required.toLowerCase()) return s;
  }
  for (const s of personSkills) {
    if (normalizeSkillName(s) === reqNorm) return s;
  }
  for (const s of personSkills) {
    const a = normalizeSkillName(s);
    const b = reqNorm;
    if (a.includes(b) || b.includes(a)) return s;
  }
  return null;
}

export function parseMatcherInput(input: string): SkillRequirement[] {
  const tokens = input
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  return tokens.map((token) => {
    const m = token.match(/^(.+?):\s*(\d(?:\.\d)?)$/);
    if (m) {
      return { skill: m[1].trim(), minRating: parseFloat(m[2]) };
    }
    return { skill: token, minRating: 3 };
  });
}

export function scoreCandidate(
  person: TeamMemberClient,
  requirements: SkillRequirement[]
): MatchResult | null {
  if (requirements.length === 0) return null;

  const ratings = person.ratings;
  let totalScore = 0;
  let met = 0;
  let partial = 0;
  let miss = 0;
  const matched: MatchResult["matched"] = [];

  for (const req of requirements) {
    const skill = fuzzyMatchSkill(person.skills, req.skill);
    if (!skill) {
      miss++;
      matched.push({ req: req.skill, skill: "", rating: 0, status: "miss" });
      continue;
    }
    const rating = ratings[skill] ?? 0;
    if (rating >= req.minRating) {
      totalScore += rating;
      met++;
      matched.push({ req: req.skill, skill, rating, status: "met" });
    } else {
      totalScore += rating * 0.5;
      partial++;
      matched.push({ req: req.skill, skill, rating, status: "partial" });
    }
  }

  if (met + partial === 0) return null;

  const normalizedScore = totalScore / requirements.length;
  return {
    person,
    normalizedScore,
    strengthPct: Math.round((normalizedScore / 5) * 100),
    met,
    partial,
    miss,
    matched,
  };
}

export function rankCandidates(
  people: TeamMemberClient[],
  requirements: SkillRequirement[]
): MatchResult[] {
  return people
    .map((p) => scoreCandidate(p, requirements))
    .filter((r): r is MatchResult => r != null)
    .sort((a, b) => {
      if (b.met !== a.met) return b.met - a.met;
      return b.normalizedScore - a.normalizedScore;
    });
}

export function toClientMember(doc: {
  _id?: { toString(): string };
  id: string;
  name: string;
  role: string;
  exp: string;
  expNum: number;
  skills: string[];
  email: string;
  stackLabel?: string;
  tags?: string[];
  projects?: string[];
  notes?: string;
  specialization: string;
  specializations?: string[];
  stacks: string[];
  aiRatings: Record<string, number>;
  ratingOverrides: Record<string, number>;
  aiFlags?: import("./types").AiFlag;
  nextSteps?: string;
  nextStepsLog?: import("./types").WorkflowEntry[];
  escalations?: import("./types").WorkflowEntry[];
}): TeamMemberClient {
  const ratings = effectiveRatings(doc.aiRatings, doc.ratingOverrides);
  return {
    _id: doc._id?.toString() ?? doc.id,
    id: doc.id,
    name: doc.name,
    role: doc.role,
    exp: doc.exp,
    expNum: doc.expNum,
    skills: doc.skills,
    email: doc.email,
    stackLabel: doc.stackLabel ?? "",
    tags: doc.tags ?? [],
    projects: doc.projects ?? [],
    notes: doc.notes ?? "",
    specialization: doc.specialization,
    specializations:
      doc.specializations && doc.specializations.length > 0
        ? doc.specializations
        : [doc.specialization],
    stacks: doc.stacks as TeamMemberClient["stacks"],
    aiRatings: doc.aiRatings,
    ratingOverrides: doc.ratingOverrides,
    ratings,
    aiFlags: normalizeAiFlag(doc.aiFlags),
    nextSteps: doc.nextSteps ?? "",
    nextStepsLog: doc.nextStepsLog ?? [],
    escalations: doc.escalations ?? [],
  };
}
