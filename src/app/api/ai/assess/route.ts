import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enabledAssessFields, type AssessFieldConfig } from "@/lib/assessFields";
import { buildProfilePayloadForAI, profilePayloadText } from "@/lib/aiProfile";
import { ASSESS_SYSTEM } from "@/lib/aiPrompts";
import { assessProfileFlags } from "@/lib/flagAssessment";
import { applyAssessmentToMember, type AssessmentResult } from "@/lib/applyAssessment";
import { connectDB } from "@/lib/mongodb";
import { docToPlain, TeamMemberModel } from "@/models/TeamMember";
import { toClientMember } from "@/lib/matcher";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const FlagPartSchema = z.object({
  flagged: z.boolean(),
  severity: z.enum([
    "none",
    "ok",
    "info",
    "watch",
    "action",
    "replacement",
  ]),
  summary: z.string(),
  reasons: z.array(z.string()),
});

const AssessSchema = z.object({
  specializations: z.array(z.string()).optional(),
  stackLabel: z.string().optional(),
  ratingUpdates: z.record(z.number()).optional(),
  clearOverrides: z.array(z.string()).optional(),
  flag: FlagPartSchema.optional(),
  suggestedNextSteps: z.string().optional(),
  summary: z.string().optional(),
});

function buildFieldInstructions(fields: string[]): string {
  const lines: string[] = [
    `Assess ONLY these fields (include only these keys in JSON): ${fields.join(", ")}`,
  ];
  if (fields.includes("specializations")) {
    lines.push("- specializations: 1–4 granular labels from the allowed list");
  }
  if (fields.includes("skillRatings")) {
    lines.push(
      "- ratingUpdates: every skill in profile; clearOverrides: skills to reset manual overrides"
    );
  }
  if (fields.includes("flags")) {
    lines.push("- flag: staffing / quality review");
  }
  if (fields.includes("nextSteps")) {
    lines.push("- suggestedNextSteps: one actionable line");
  }
  if (fields.includes("stacks")) {
    lines.push("- stackLabel: primary stack");
  }
  return lines.join("\n");
}

function parseFlagPayload(raw: unknown): z.infer<typeof FlagPartSchema> | null {
  if (!raw || typeof raw !== "object") return null;
  const result = FlagPartSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function parseAssessment(raw: string, fields: string[]): AssessmentResult {
  const json = JSON.parse(raw) as Record<string, unknown>;
  const parsed = AssessSchema.parse({
    ...json,
    flag: json.flag ?? json.flags,
  });
  const out: AssessmentResult = { summary: parsed.summary };

  if (fields.includes("specializations") && parsed.specializations?.length) {
    out.specializations = parsed.specializations;
  }
  if (fields.includes("stacks") && parsed.stackLabel) {
    out.stackLabel = parsed.stackLabel;
  }
  if (fields.includes("skillRatings")) {
    out.ratingUpdates = parsed.ratingUpdates ?? {};
    out.clearOverrides = parsed.clearOverrides ?? [];
  }
  if (fields.includes("flags")) {
    const f = parsed.flag ?? parseFlagPayload(json.flags);
    if (f) {
      const reviewedAt = new Date().toISOString();
      const severity = f.severity;
      out.flag = {
        flagged:
          f.flagged ||
          severity === "info" ||
          severity === "watch" ||
          severity === "action" ||
          severity === "replacement",
        severity,
        summary: f.summary ?? "",
        reasons: f.reasons ?? [],
        flaggedAt: reviewedAt,
      };
    }
  }
  if (fields.includes("nextSteps") && parsed.suggestedNextSteps) {
    out.suggestedNextSteps = parsed.suggestedNextSteps;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 400 });
    }

    const body = (await req.json()) as {
      id: string;
      fields: AssessFieldConfig[];
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const configs = body.fields ?? [];
    if (!configs.some((c) => c.enabled)) {
      return NextResponse.json(
        { error: "Select at least one field to assess" },
        { status: 400 }
      );
    }

    await connectDB();
    const doc = await TeamMemberModel.findOne({ id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const member = toClientMember(docToPlain(doc));
    const fieldsToRun = enabledAssessFields(configs);
    const redoFields = configs
      .filter((c) => c.enabled && c.redo)
      .map((c) => c.field);

    const openai = new OpenAI({ apiKey: key });
    let assessment: AssessmentResult = {};
    let raw = "{}";

    const nonFlagFields = fieldsToRun.filter((f) => f !== "flags");

    if (nonFlagFields.length > 0) {
      const payload = buildProfilePayloadForAI(member);
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ASSESS_SYSTEM },
          {
            role: "user",
            content: `${buildFieldInstructions(nonFlagFields)}${
              redoFields.length
                ? `\n\nReplace existing values for: ${redoFields.join(", ")}`
                : ""
            }\n\nProfile:\n${profilePayloadText(payload)}`,
          },
        ],
      });
      raw = completion.choices[0]?.message?.content ?? "{}";
      try {
        assessment = parseAssessment(raw, nonFlagFields);
      } catch {
        return NextResponse.json(
          { error: "AI returned invalid assessment JSON", raw },
          { status: 422 }
        );
      }
    }

    if (fieldsToRun.includes("flags")) {
      const { flag, suggestedNextSteps } = await assessProfileFlags(
        openai,
        member,
        { replaceExisting: redoFields.includes("flags") }
      );
      assessment.flag = flag;
      if (suggestedNextSteps?.trim() && !nonFlagFields.includes("nextSteps")) {
        assessment.suggestedNextSteps = suggestedNextSteps;
      }
    }

    const missing: string[] = [];
    if (fieldsToRun.includes("flags") && !assessment.flag) {
      missing.push("flags");
    }
    if (
      fieldsToRun.includes("specializations") &&
      !assessment.specializations?.length
    ) {
      missing.push("specializations");
    }

    if (missing.length === fieldsToRun.length) {
      return NextResponse.json(
        {
          error: `AI did not return required fields: ${missing.join(", ")}`,
          raw,
        },
        { status: 422 }
      );
    }

    await applyAssessmentToMember(doc, fieldsToRun, assessment, redoFields);

    const fresh = await TeamMemberModel.findOne({ id }).lean();
    const memberOut = toClientMember(docToPlain(fresh));
    return NextResponse.json({
      member: memberOut,
      flag: memberOut.aiFlags,
      applied: fieldsToRun,
      summary: assessment.summary ?? assessment.flag?.summary,
      skipped: false,
      warnings: missing.length ? `Missing from AI response: ${missing.join(", ")}` : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assessment failed" },
      { status: 500 }
    );
  }
}
