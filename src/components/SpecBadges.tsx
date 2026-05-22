"use client";

import { OverflowChips } from "./OverflowChips";
import { Tooltip } from "./Tooltip";

export function SpecBadges({
  specializations,
  limit = 1,
  nowrap = false,
  className = "",
}: {
  specializations: string[];
  limit?: number;
  nowrap?: boolean;
  className?: string;
}) {
  const list = specializations.filter(
    (s) => s && s !== "Profile Pending"
  );

  return (
    <OverflowChips
      items={list}
      limit={limit}
      nowrap={nowrap}
      className={className}
      panelTitle="All specializations"
      renderChip={(s) => (
        <Tooltip key={s} content={s} force inline>
          <span className="inline-flex h-[18px] max-w-[5.5rem] items-center truncate rounded border border-accent/30 bg-accent/10 px-1 font-mono text-[9px] leading-none text-accent-dim">
            {s}
          </span>
        </Tooltip>
      )}
    />
  );
}
