import type { TeamMemberClient } from "./types";

export const ASSESS_FIELD_OPTIONS = [
  {
    id: "specializations",
    label: "Specializations",
    description: "AI infers granular specs (e.g. Full Stack (Node), DevOps)",
  },
  {
    id: "skillRatings",
    label: "Skill ratings",
    description: "AI scores each listed skill 1–5",
  },
  {
    id: "flags",
    label: "AI flags",
    description: "Staffing risks and profile quality flags",
  },
  {
    id: "nextSteps",
    label: "Next steps",
    description: "Suggested follow-up actions",
  },
  {
    id: "stacks",
    label: "Stack label",
    description: "Primary stack label (MERN, .NET, etc.)",
  },
] as const;

export type AssessField = (typeof ASSESS_FIELD_OPTIONS)[number]["id"];

export type AssessFieldConfig = {
  field: AssessField;
  enabled: boolean;
  redo: boolean;
};

export function defaultAssessFieldConfigs(): AssessFieldConfig[] {
  return ASSESS_FIELD_OPTIONS.map((o) => ({
    field: o.id,
    enabled: true,
    redo: false,
  }));
}

export function shouldAssessField(
  field: AssessField,
  member: TeamMemberClient,
  redo: boolean
): boolean {
  if (redo) return true;
  switch (field) {
    case "specializations": {
      const specs =
        member.specializations?.length > 0
          ? member.specializations
          : [member.specialization];
      return (
        specs.length === 0 ||
        (specs.length === 1 &&
          (specs[0] === "Profile Pending" || !specs[0]?.trim()))
      );
    }
    case "skillRatings":
      return (
        member.skills.length > 0 &&
        Object.keys(member.aiRatings ?? {}).length < member.skills.length
      );
    case "flags":
      return (
        !member.aiFlags?.flagged &&
        (!member.aiFlags?.summary || member.aiFlags.severity === "none")
      );
    case "nextSteps":
      return !member.nextSteps?.trim();
    case "stacks":
      return !member.stackLabel?.trim();
    default:
      return true;
  }
}

/** Fields the user selected to assess — always sent to AI when enabled */
export function enabledAssessFields(
  configs: AssessFieldConfig[]
): AssessField[] {
  return configs.filter((c) => c.enabled).map((c) => c.field);
}

/** @deprecated Use enabledAssessFields — kept for tests */
export function activeAssessFields(
  configs: AssessFieldConfig[],
  _member: TeamMemberClient
): AssessField[] {
  return enabledAssessFields(configs);
}
