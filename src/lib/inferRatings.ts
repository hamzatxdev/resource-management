import {
  AI_PATTERNS,
  BACKEND_PATTERNS,
  FRONTEND_PATTERNS,
  QA_PATTERNS,
} from "./categorize";
import type { TeamMemberInput } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function seniorityBoost(role: string): number {
  const r = role.toLowerCase();
  if (/tech lead/.test(r)) return 0.6;
  if (/senior/.test(r)) return 0.35;
  if (/associate/.test(r)) return -0.3;
  return 0;
}

function specializationBoost(spec: string, skill: string): number {
  const s = spec.toLowerCase();
  if (s.includes("ai/ml") || s.includes("ai business")) {
    return AI_PATTERNS.test(skill) ? 0.3 : 0;
  }
  if (s.includes("frontend")) return FRONTEND_PATTERNS.test(skill) ? 0.3 : 0;
  if (s.includes("backend") || s.includes("full stack"))
    return BACKEND_PATTERNS.test(skill) || FRONTEND_PATTERNS.test(skill) ? 0.3 : 0;
  if (s === "qa" || s.includes("quality")) return QA_PATTERNS.test(skill) ? 0.3 : 0;
  if (s.includes("devops")) return DEVOPS_PATTERNS.test(skill) ? 0.3 : 0;
  if (s.includes("full stack")) {
    return FRONTEND_PATTERNS.test(skill) || BACKEND_PATTERNS.test(skill)
      ? 0.3
      : 0;
  }
  return 0;
}

const DEVOPS_PATTERNS =
  /docker|kubernetes|k8s|terraform|jenkins|ci\/cd|aws|azure|ansible|helm|linux|nginx/i;

export function inferSkillRatings(
  member: Pick<TeamMemberInput, "role" | "expNum" | "skills"> & {
    specializations: string[];
  }
): Record<string, number> {
  const total = member.skills.length;
  const ratings: Record<string, number> = {};

  member.skills.forEach((skill, index) => {
    let r = Math.min(5, 2 + member.expNum * 0.35);
    r += seniorityBoost(member.role);
    if (total > 1) {
      r += 0.4 - (index / (total - 1)) * 0.8;
    }
    const specBoost = member.specializations.reduce(
      (max, spec) => Math.max(max, specializationBoost(spec, skill)),
      0
    );
    r += specBoost;
    r = clamp(Math.round(r * 2) / 2, 1, 5);
    ratings[skill] = r;
  });

  return ratings;
}

export function effectiveRatings(
  aiRatings: Record<string, number>,
  overrides: Record<string, number>
): Record<string, number> {
  return { ...aiRatings, ...overrides };
}

export function mergeOverrides(
  aiRatings: Record<string, number>,
  overrides: Record<string, number>,
  skill: string,
  value: number | null
): Record<string, number> {
  const next = { ...overrides };
  if (value == null || value === aiRatings[skill]) {
    delete next[skill];
  } else {
    next[skill] = value;
  }
  return next;
}

export const RATING_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function applyBulkOverrides(
  aiRatings: Record<string, number>,
  overrides: Record<string, number>,
  updates: Record<string, number | null>
): Record<string, number> {
  let next = { ...overrides };
  for (const [skill, value] of Object.entries(updates)) {
    next = mergeOverrides(aiRatings, next, skill, value);
  }
  return next;
}
