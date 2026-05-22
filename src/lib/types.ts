/** @deprecated Use granular specializations[] */
export type Specialization =
  | "Full Stack"
  | "Frontend"
  | "Backend"
  | "AI/ML"
  | "AI Business Analyst"
  | "QA"
  | "Tech Lead"
  | "Project Manager"
  | "Other"
  | "Profile Pending";

export type Stack =
  | "MERN"
  | "MEAN"
  | "PERN"
  | ".NET"
  | "Python / AI"
  | "React Native"
  | "WordPress";

export type FlagSeverity =
  | "none"
  | "ok"
  | "info"
  | "watch"
  | "action"
  | "replacement";

export interface AiFlag {
  flagged: boolean;
  severity: FlagSeverity;
  reasons: string[];
  summary: string;
  flaggedAt?: string;
}

export interface WorkflowEntry {
  id: string;
  text: string;
  createdAt: string;
  assessment?: string;
  appliedAt?: string;
}

/** @alias WorkflowEntry */
export type EscalationEntry = WorkflowEntry;

export interface TeamMemberInput {
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
  specializations?: string[];
  nextSteps?: string;
}

export interface TeamMemberDoc extends TeamMemberInput {
  _id?: string;
  specialization: string;
  specializations: string[];
  stacks: Stack[];
  stackLabel: string;
  tags: string[];
  projects: string[];
  notes: string;
  aiRatings: Record<string, number>;
  ratingOverrides: Record<string, number>;
  aiFlags: AiFlag;
  /** Latest next step (denormalized from log) */
  nextSteps: string;
  nextStepsLog: WorkflowEntry[];
  escalations: WorkflowEntry[];
  embedding?: number[];
  embeddingText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TeamMemberClient = Omit<TeamMemberDoc, "_id" | "embedding"> & {
  _id: string;
  ratings: Record<string, number>;
};

export const DEFAULT_AI_FLAG: AiFlag = {
  flagged: false,
  severity: "none",
  reasons: [],
  summary: "",
};
