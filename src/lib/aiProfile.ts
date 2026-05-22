import { tagsForAI } from "./tags";
import type { TeamMemberClient } from "./types";

export function buildProfilePayloadForAI(member: TeamMemberClient) {
  const ratedSkills = member.skills
    .map((s) => {
      const r = member.ratings[s] ?? member.aiRatings[s];
      const ov = member.ratingOverrides[s] != null ? " (override)" : "";
      return `${s}: ${r ?? "?"}${ov}`;
    })
    .join(", ");

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    exp: member.exp,
    specializations: member.specializations?.join(", ") ?? member.specialization,
    stacks: member.stacks?.join(", "),
    stackLabel: member.stackLabel,
    tags: tagsForAI(member.tags),
    skillsRated: ratedSkills,
    projects: member.projects?.join(", "),
    notes: member.notes,
    nextSteps: member.nextSteps,
    priorEscalations: (member.escalations ?? [])
      .slice(-5)
      .map((e) => `[${e.createdAt}] ${e.text}${e.assessment ? ` → ${e.assessment}` : ""}`)
      .join("\n"),
    currentFlags: member.aiFlags,
  };
}

export function profilePayloadText(p: ReturnType<typeof buildProfilePayloadForAI>) {
  return JSON.stringify(p, null, 2);
}
