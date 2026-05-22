import { DEFAULT_AI_FLAG, type AiFlag } from "./types";

export function normalizeAiFlag(raw: unknown): AiFlag {
  const f = raw as Record<string, unknown> | undefined;
  if (!f) return { ...DEFAULT_AI_FLAG };
  return {
    flagged: Boolean(f.flagged),
    severity: (["none", "info", "watch", "action"].includes(
      f.severity as string
    )
      ? f.severity
      : "none") as AiFlag["severity"],
    reasons: Array.isArray(f.reasons) ? (f.reasons as string[]) : [],
    summary: (f.summary as string) ?? "",
    flaggedAt: f.flaggedAt
      ? new Date(f.flaggedAt as string).toISOString()
      : undefined,
  };
}
