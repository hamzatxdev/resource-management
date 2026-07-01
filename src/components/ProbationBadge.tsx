"use client";

import { Tooltip } from "./Tooltip";
import type { ProbationFlag } from "@/lib/types";

function formatSince(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ProbationBadge({
  probation,
  onClick,
}: {
  probation: ProbationFlag;
  onClick?: () => void;
}) {
  if (!probation?.active) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-text-faint text-xs hover:text-accent font-medium"
        title={onClick ? "Set probation" : undefined}
      >
        —
      </button>
    );
  }

  const tip = [
    probation.summary || "On probation",
    ...probation.reasons.map((r) => `• ${r}`),
    probation.since ? `Since ${formatSince(probation.since)}` : "",
    onClick ? "Click to edit" : "",
  ]
    .filter(Boolean)
    .join("\n");

  const badge = (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Probation
    </span>
  );

  if (onClick) {
    return (
      <Tooltip content={tip} force maxWidth={360}>
        <button
          type="button"
          onClick={onClick}
          className="rounded hover:ring-1 hover:ring-orange-400/50"
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
