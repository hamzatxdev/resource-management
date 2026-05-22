import OpenAI from "openai";
import { z } from "zod";
import { buildProfilePayloadForAI, profilePayloadText } from "./aiProfile";
import { FLAG_SYSTEM } from "./aiPrompts";
import type { TeamMemberClient, AiFlag } from "./types";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const FlagSchema = z.object({
  flagged: z.boolean(),
  severity: z.enum(["none", "info", "watch", "action"]),
  summary: z.string(),
  reasons: z.array(z.string()),
  suggestedNextSteps: z.string().optional(),
});

export function flagFromParsed(parsed: z.infer<typeof FlagSchema>): AiFlag {
  const reviewedAt = new Date().toISOString();
  return {
    flagged: parsed.flagged,
    severity: parsed.flagged ? parsed.severity : "none",
    summary: parsed.summary ?? "",
    reasons: parsed.reasons ?? [],
    flaggedAt: reviewedAt,
  };
}

/** Dedicated flag review (same quality as /api/ai/flag) */
export async function assessProfileFlags(
  openai: OpenAI,
  member: TeamMemberClient,
  opts?: { replaceExisting?: boolean }
): Promise<{ flag: AiFlag; suggestedNextSteps?: string; raw?: string }> {
  const payload = buildProfilePayloadForAI(member);
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: FLAG_SYSTEM },
      {
        role: "user",
        content: `${
          opts?.replaceExisting
            ? "Re-review and replace the previous flag decision.\n\n"
            : ""
        }Review this profile:\n${profilePayloadText(payload)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const json = JSON.parse(raw) as unknown;
    const result = FlagSchema.safeParse(json);
    if (!result.success) {
      return {
        flag: {
          flagged: false,
          severity: "none",
          summary: "AI returned an invalid flag payload",
          reasons: result.error.issues.map((i) => i.message),
          flaggedAt: new Date().toISOString(),
        },
        raw,
      };
    }
    const flag = flagFromParsed(result.data);
    if (!flag.summary?.trim() && !flag.flagged) {
      flag.summary = "Reviewed — no staffing concerns identified.";
    }
    return {
      flag,
      suggestedNextSteps: result.data.suggestedNextSteps,
      raw,
    };
  } catch {
    return {
      flag: {
        flagged: false,
        severity: "none",
        summary: "Could not parse AI flag response",
        reasons: [],
        flaggedAt: new Date().toISOString(),
      },
      raw,
    };
  }
}
