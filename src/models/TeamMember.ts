import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { normalizeAiFlag } from "@/lib/aiFlags";
import { DEFAULT_AI_FLAG } from "@/lib/types";
import {
  buildNextStepsLog,
  normalizeWorkflowEntries,
} from "@/lib/workflow";

const WorkflowEntrySchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    assessment: { type: String, default: "" },
    appliedAt: { type: Date },
  },
  { _id: false }
);

const AiFlagSchema = new Schema(
  {
    flagged: { type: Boolean, default: false },
    severity: {
      type: String,
      enum: ["none", "info", "watch", "action"],
      default: "none",
    },
    reasons: { type: [String], default: [] },
    summary: { type: String, default: "" },
    flaggedAt: { type: Date },
  },
  { _id: false }
);

const TeamMemberSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    exp: { type: String, default: "" },
    expNum: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    email: { type: String, default: "" },
    stackLabel: { type: String, default: "" },
    tags: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    notes: { type: String, default: "" },
    specialization: { type: String, default: "Profile Pending" },
    specializations: { type: [String], default: [] },
    stacks: { type: [String], default: [] },
    aiRatings: { type: Object, default: {} },
    ratingOverrides: { type: Object, default: {} },
    embedding: { type: [Number], default: undefined },
    embeddingText: { type: String, default: "" },
    aiFlags: { type: AiFlagSchema, default: () => ({ ...DEFAULT_AI_FLAG }) },
    nextSteps: { type: String, default: "" },
    nextStepsLog: { type: [WorkflowEntrySchema], default: [] },
    escalations: { type: [WorkflowEntrySchema], default: [] },
  },
  { timestamps: true }
);

export type TeamMemberMongoose = InferSchemaType<typeof TeamMemberSchema>;

function mapToRecord(
  value?: Map<string, number> | Record<string, number>
): Record<string, number> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...(value as Record<string, number>) };
}

export function docToPlain(doc: unknown) {
  const d = doc as Record<string, unknown>;
  const _id =
    typeof d._id === "object" &&
    d._id !== null &&
    "toString" in d._id &&
    typeof (d._id as { toString(): string }).toString === "function"
      ? (d._id as { toString(): string }).toString()
      : String(d._id ?? "");

  return {
    _id,
    id: d.id as string,
    name: (d.name as string) ?? "",
    role: (d.role as string) ?? "",
    exp: (d.exp as string) ?? "",
    expNum: (d.expNum as number) ?? 0,
    skills: (d.skills as string[]) ?? [],
    email: (d.email as string) ?? "",
    stackLabel: (d.stackLabel as string) ?? "",
    tags: (d.tags as string[]) ?? [],
    projects: (d.projects as string[]) ?? [],
    notes: (d.notes as string) ?? "",
    specialization: (d.specialization as string) ?? "Profile Pending",
    specializations:
      (d.specializations as string[])?.length > 0
        ? (d.specializations as string[])
        : d.specialization
          ? [d.specialization as string]
          : ["Profile Pending"],
    stacks: (d.stacks as string[]) ?? [],
    aiRatings: mapToRecord(d.aiRatings as Map<string, number>),
    ratingOverrides: mapToRecord(d.ratingOverrides as Map<string, number>),
    embedding: d.embedding as number[] | undefined,
    embeddingText: (d.embeddingText as string) ?? "",
    aiFlags: normalizeAiFlag(d.aiFlags),
    nextSteps: (d.nextSteps as string) ?? "",
    nextStepsLog: buildNextStepsLog(
      d.nextStepsLog,
      (d.nextSteps as string) ?? "",
      (d.updatedAt as Date | undefined) ?? (d.createdAt as Date | undefined)
    ),
    escalations: normalizeWorkflowEntries(d.escalations),
    createdAt: d.createdAt as Date | undefined,
    updatedAt: d.updatedAt as Date | undefined,
  };
}

export const TeamMemberModel =
  mongoose.models.TeamMember ??
  mongoose.model("TeamMember", TeamMemberSchema);
