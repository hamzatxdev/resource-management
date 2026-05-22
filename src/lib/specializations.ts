import {
  AI_PATTERNS,
  BACKEND_PATTERNS,
  FRONTEND_PATTERNS,
  QA_PATTERNS,
} from "./categorize";
import { specializationsFromTags } from "./tags";
import type { TeamMemberInput } from "./types";

/** All known granular labels (for pickers); free text also allowed */
export const GRANULAR_SPEC_PRESETS = [
  "Full Stack (Node)",
  "Full Stack (Python)",
  "Full Stack (.NET)",
  "Frontend",
  "Backend (Node)",
  "Backend (.NET)",
  "AI/ML",
  "AI Business Analyst",
  "QA",
  "DevOps",
  "DevOps (Basic)",
  "Tech Lead",
  "Project Manager",
  "Business Analyst",
  "Profile Pending",
  "Other",
] as const;

const DEVOPS_STRONG =
  /docker|kubernetes|k8s|terraform|jenkins|ci\/cd|github actions|gitlab|helm|ansible|aws|azure|gcp|prometheus|grafana|argocd/i;
const DEVOPS_BASIC = /docker|ci\/cd|jenkins|devops|nginx|linux/i;

function skillTest(skills: string[], re: RegExp) {
  return skills.some((s) => re.test(s));
}

export function detectGranularSpecializations(
  member: Pick<TeamMemberInput, "role" | "skills" | "tags">
): string[] {
  const role = member.role.toLowerCase();
  const skills = member.skills;
  const lower = skills.map((s) => s.toLowerCase());
  const specs = new Set<string>();

  const fromTags = specializationsFromTags(member.tags ?? []);
  fromTags.forEach((s) => specs.add(s));

  if (!role && skills.length === 0 && specs.size === 0) {
    return ["Profile Pending"];
  }

  if (/tech lead/.test(role)) specs.add("Tech Lead");
  if (/project manager/.test(role)) specs.add("Project Manager");
  if (/business analyst/.test(role) && !/ai business/.test(role)) {
    specs.add("Business Analyst");
  }
  if (/ai business/.test(role)) specs.add("AI Business Analyst");
  if (/sqa|quality assurance/.test(role)) specs.add("QA");
  if (/ai\/ml|\(ai\/ml\)|ai\/ml engineer/.test(role)) specs.add("AI/ML");
  if (/devops|sre|platform engineer/.test(role)) specs.add("DevOps");

  const hasFrontend = skills.some((s) => FRONTEND_PATTERNS.test(s));
  const hasBackend = skills.some((s) => BACKEND_PATTERNS.test(s));
  const hasAI = skills.some((s) => AI_PATTERNS.test(s));
  const hasQA = skills.some((s) => QA_PATTERNS.test(s));
  const hasNode = skillTest(lower, /node|nest|express/);
  const hasPython = skillTest(lower, /python|django|flask|fastapi/);
  const hasDotNet = skillTest(lower, /\.net|asp\.net|c#/);

  const devopsStrongCount = skills.filter((s) => DEVOPS_STRONG.test(s)).length;
  const devopsBasicCount = skills.filter((s) => DEVOPS_BASIC.test(s)).length;

  if (devopsStrongCount >= 3) specs.add("DevOps");
  else if (devopsBasicCount >= 2 || /devops/.test(role)) specs.add("DevOps (Basic)");

  if (hasAI) specs.add("AI/ML");
  if (hasQA && !hasFrontend && !hasBackend) specs.add("QA");

  if (hasFrontend && hasBackend && hasNode) specs.add("Full Stack (Node)");
  if (hasFrontend && hasBackend && hasPython) specs.add("Full Stack (Python)");
  if (hasFrontend && hasBackend && hasDotNet) specs.add("Full Stack (.NET)");
  if (hasFrontend && hasBackend && !hasNode && !hasPython && !hasDotNet) {
    specs.add("Full Stack");
  }

  if (hasFrontend && !hasBackend) specs.add("Frontend");
  if (hasBackend && hasNode && !hasFrontend) specs.add("Backend (Node)");
  if (hasBackend && hasDotNet && !hasFrontend) specs.add("Backend (.NET)");

  let list = [...specs].filter((s) => s !== "Profile Pending");
  if (list.length === 0) list = ["Other"];
  return list;
}

export function mergeSpecializations(
  detected: string[],
  existing: string[] = []
): string[] {
  const merged = [...new Set([...existing, ...detected])].filter(Boolean);
  const withoutPending = merged.filter((s) => s !== "Profile Pending");
  return withoutPending.length ? withoutPending : ["Profile Pending"];
}

/** Primary label for legacy single field / compact display */
export function primarySpecialization(specializations: string[]): string {
  if (!specializations.length) return "Profile Pending";
  return specializations[0];
}

export function matchesSpecFilter(
  specializations: string[],
  filter: string
): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  return specializations.some(
    (s) => s.toLowerCase() === f || s.toLowerCase().includes(f)
  );
}
