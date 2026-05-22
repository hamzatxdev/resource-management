import { DEFAULT_AI_FLAG, type AiFlag, type FlagSeverity } from "./types";

export const FLAG_SEVERITIES = [
  "none",
  "ok",
  "info",
  "watch",
  "action",
  "replacement",
] as const satisfies readonly FlagSeverity[];

/** Severities that show a badge and appear in "Flagged only" filter */
export const FLAG_BADGE_SEVERITIES: FlagSeverity[] = [
  "ok",
  "info",
  "watch",
  "action",
  "replacement",
];

export function normalizeSeverity(raw: unknown): FlagSeverity {
  const s = String(raw ?? "none").toLowerCase();
  if (s === "replacement" || s === "replace") return "replacement";
  if (FLAG_SEVERITIES.includes(s as FlagSeverity)) return s as FlagSeverity;
  return "none";
}

/** Whether this profile should show in staffing-flag filters */
export function hasStaffingFlag(flag: AiFlag | undefined): boolean {
  if (!flag) return false;
  if (flag.flagged) return true;
  return ["info", "watch", "action", "replacement"].includes(flag.severity);
}

/** UI flag filter: "" = all, "staffing" = any staffing flag, or a specific severity */
export function memberMatchesFlagFilter(
  flag: AiFlag | undefined,
  filter: string
): boolean {
  if (!filter) return true;
  const f = flag ?? DEFAULT_AI_FLAG;
  const severity = normalizeSeverity(f.severity);
  if (filter === "staffing") return hasStaffingFlag(f);
  if (filter === "none") return severity === "none" && !f.flagged;
  if (filter === "ok") return severity === "ok";
  return severity === filter;
}

export function normalizeAiFlag(raw: unknown): AiFlag {
  const f = raw as Record<string, unknown> | undefined;
  if (!f) return { ...DEFAULT_AI_FLAG };
  const severity = normalizeSeverity(f.severity);
  const summary = (f.summary as string) ?? "";
  const reasons = Array.isArray(f.reasons) ? (f.reasons as string[]) : [];
  const flaggedAt = f.flaggedAt
    ? new Date(f.flaggedAt as string).toISOString()
    : undefined;
  const flagged =
    typeof f.flagged === "boolean"
      ? f.flagged
      : hasStaffingFlag({ flagged: false, severity, summary, reasons, flaggedAt });

  return {
    flagged: flagged || severity === "info",
    severity,
    reasons,
    summary,
    flaggedAt,
  };
}

/** Persist user or AI flag without wiping info/replacement when flagged is false */
export function aiFlagForDb(
  flag: AiFlag,
  opts?: { stampReview?: boolean }
): {
  flagged: boolean;
  severity: FlagSeverity;
  summary: string;
  reasons: string[];
  flaggedAt?: Date;
} {
  const severity = normalizeSeverity(flag.severity);
  const summary = flag.summary ?? "";
  const reasons = Array.isArray(flag.reasons) ? flag.reasons : [];
  const flagged =
    typeof flag.flagged === "boolean"
      ? flag.flagged
      : severity === "watch" ||
        severity === "action" ||
        severity === "replacement" ||
        severity === "info";

  const reviewed =
    flag.flaggedAt != null
      ? new Date(flag.flaggedAt)
      : opts?.stampReview
        ? new Date()
        : undefined;

  return {
    flagged,
    severity,
    summary,
    reasons,
    flaggedAt: reviewed,
  };
}

export function flagFromManualInput(input: {
  severity: FlagSeverity;
  summary?: string;
  reasons?: string[];
}): AiFlag {
  const severity = normalizeSeverity(input.severity);
  const summary = input.summary?.trim() ?? "";
  const reasons = (input.reasons ?? []).map((r) => r.trim()).filter(Boolean);
  const flagged =
    severity === "info" ||
    severity === "watch" ||
    severity === "action" ||
    severity === "replacement";

  return {
    flagged,
    severity,
    summary,
    reasons,
    flaggedAt: new Date().toISOString(),
  };
}
