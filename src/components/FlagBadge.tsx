"use client";

import { FLAG_BADGE_SEVERITIES } from "@/lib/aiFlags";
import { Tooltip } from "./Tooltip";
import type { AiFlag, FlagSeverity } from "@/lib/types";

const STYLES: Record<FlagSeverity, string> = {
  none: "text-emerald-700 bg-emerald-50 border-emerald-200",
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  info: "text-blue-700 bg-blue-50 border-blue-200",
  watch: "text-warn bg-amber-50 border-warn/40",
  action: "text-bad bg-red-50 border-bad/40",
  replacement: "text-violet-800 bg-violet-50 border-violet-300",
};

const LABELS: Record<FlagSeverity, string> = {
  none: "OK",
  ok: "OK",
  info: "Info",
  watch: "Watch",
  action: "Action",
  replacement: "Replace",
};

function formatReviewedAt(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function displaySeverity(flag: AiFlag): FlagSeverity | null {
  const s = flag.severity;
  if (FLAG_BADGE_SEVERITIES.includes(s)) return s;
  if (flag.flagged) return s === "none" ? "watch" : s;
  if (flag.flaggedAt || flag.summary?.trim()) return "ok";
  return null;
}

export function FlagBadge({
  flag,
  onClick,
}: {
  flag: AiFlag;
  onClick?: () => void;
}) {
  const level = displaySeverity(flag);
  const hasNote = Boolean(flag.summary?.trim() || flag.reasons?.length);

  if (!level) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-text-faint text-[10px] hover:text-accent"
        title={onClick ? "Set flag" : undefined}
      >
        —
      </button>
    );
  }

  const tip = [
    flag.summary || `Severity: ${LABELS[level]}`,
    ...flag.reasons.map((r) => `• ${r}`),
    flag.flaggedAt ? `Reviewed ${formatReviewedAt(flag.flaggedAt)}` : "",
    onClick ? "Click to edit flag" : "",
  ]
    .filter(Boolean)
    .join("\n");

  const badge = (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${STYLES[level]}`}
    >
      {LABELS[level]}
    </span>
  );

  if (onClick) {
    return (
      <Tooltip content={tip} force maxWidth={360}>
        <button
          type="button"
          onClick={onClick}
          className="rounded hover:ring-1 hover:ring-accent/40"
        >
          {badge}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tip} force maxWidth={360}>
      {badge}
    </Tooltip>
  );
}
