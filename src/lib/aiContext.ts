import { tagsForAI } from "./tags";
import type { TeamMemberClient } from "./types";
import { toClientMember } from "./matcher";

type MemberLike = Parameters<typeof toClientMember>[0];

export function memberContextLine(
  member: MemberLike,
  scorePct?: number
): string {
  const client = toClientMember(member);
  const topSkills = member.skills
    .slice(0, 14)
    .map((s) => `${s}: ${client.ratings[s] ?? member.aiRatings[s]}/5`)
    .join(", ");

  const tagBlock = tagsForAI(member.tags ?? []);
  const notes = (member as { notes?: string }).notes?.trim();

  const parts = [
    `[${member.id}] ${member.name}`,
    member.role ? `Role: ${member.role}` : null,
    member.exp ? `Exp: ${member.exp}` : null,
    `Specializations: ${(member.specializations ?? [member.specialization]).join(", ")}`,
    member.stackLabel ? `Stack: ${member.stackLabel}` : null,
    `Tags: ${tagBlock}`,
    notes ? `Profile notes: ${notes}` : null,
    member.projects?.length
      ? `Projects: ${member.projects.join(", ")}`
      : null,
    topSkills ? `Skills: ${topSkills}` : null,
    scorePct != null ? `(relevance ${scorePct}%)` : null,
  ].filter(Boolean);

  return parts.join(" | ");
}
