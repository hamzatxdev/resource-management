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
        className="text-text-faint text-[10px] hover:text-accent"
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
    <span className="inline-flex items-center rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-orange-800">
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
