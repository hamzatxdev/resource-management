import {
  DEFAULT_PROBATION,
  type ProbationFlag,
} from "./types";

export function normalizeProbation(raw: unknown): ProbationFlag {
  const p = raw as Record<string, unknown> | undefined;
  if (!p) return { ...DEFAULT_PROBATION };
  const active = Boolean(p.active);
  const summary = (p.summary as string) ?? "";
  const reasons = Array.isArray(p.reasons) ? (p.reasons as string[]) : [];
  const since = p.since
    ? new Date(p.since as string).toISOString()
    : undefined;
  return { active, summary, reasons, since };
}

export function probationForDb(
  flag: ProbationFlag,
  opts?: { stampSince?: boolean }
): {
  active: boolean;
  summary: string;
  reasons: string[];
  since?: Date;
} {
  const active = Boolean(flag.active);
  const summary = flag.summary?.trim() ?? "";
  const reasons = Array.isArray(flag.reasons)
    ? flag.reasons.map((r) => r.trim()).filter(Boolean)
    : [];
  if (!active) {
    return { active: false, summary: "", reasons: [], since: undefined };
  }

  const since =
    flag.since != null
      ? new Date(flag.since)
      : opts?.stampSince
        ? new Date()
        : undefined;

  return { active, summary, reasons, since };
}

export function probationFromManualInput(input: {
  active: boolean;
  summary?: string;
  reasons?: string[];
  since?: string;
}): ProbationFlag {
  const active = Boolean(input.active);
  const summary = input.summary?.trim() ?? "";
  const reasons = (input.reasons ?? []).map((r) => r.trim()).filter(Boolean);
  return {
    active,
    summary,
    reasons,
    since: active
      ? input.since ?? new Date().toISOString()
      : undefined,
  };
}

export function hasActiveProbation(flag: ProbationFlag | undefined): boolean {
  return Boolean(flag?.active);
}
