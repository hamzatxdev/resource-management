"use client";

import { Tooltip } from "./Tooltip";
import type { AiFlag, FlagSeverity } from "@/lib/types";

const STYLES: Record<FlagSeverity, string> = {
  none: "text-emerald-700 bg-emerald-50 border-emerald-200",
  info: "text-blue-700 bg-blue-50 border-blue-200",
  watch: "text-warn bg-amber-50 border-warn/40",
  action: "text-bad bg-red-50 border-bad/40",
};

const LABELS: Record<FlagSeverity, string> = {
  none: "OK",
  info: "Info",
  watch: "Watch",
  action: "Action",
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

export function FlagBadge({ flag }: { flag: AiFlag }) {
  const reviewed = Boolean(flag.flaggedAt);
  const hasNote = Boolean(flag.summary?.trim() || flag.reasons?.length);

  if (!flag.flagged) {
    if (reviewed || hasNote) {
      const tip = [
        flag.summary || "No staffing concerns flagged.",
        ...flag.reasons.map((r) => `• ${r}`),
        flag.flaggedAt
          ? `Reviewed ${formatReviewedAt(flag.flaggedAt)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      return (
        <Tooltip content={tip} force maxWidth={360}>
          <span
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${STYLES.none}`}
          >
            {LABELS.none}
          </span>
        </Tooltip>
      );
    }
    return <span className="text-text-faint text-[10px]">—</span>;
  }

  const tip = [
    flag.summary,
    ...flag.reasons.map((r) => `• ${r}`),
    flag.flaggedAt ? `Reviewed ${formatReviewedAt(flag.flaggedAt)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tooltip content={tip} force maxWidth={360}>
      <span
        className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${STYLES[flag.severity]}`}
      >
        {LABELS[flag.severity]}
      </span>
    </Tooltip>
  );
}
