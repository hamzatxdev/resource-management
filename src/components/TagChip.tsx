"use client";

import { parseTag, type ParsedTag } from "@/lib/tags";
import { OverflowChips } from "./OverflowChips";
import { Tooltip } from "./Tooltip";

export function TagChip({
  tag,
  onRemove,
  parsed: preParsed,
}: {
  tag: string;
  onRemove?: () => void;
  parsed?: ParsedTag;
}) {
  const p = preParsed ?? parseTag(tag);
  const style =
    p.type === "allocation"
      ? "border-good/40 bg-green-50 text-good"
      : p.type === "certificate"
        ? "border-blue-300 bg-blue-50 text-blue-800"
        : p.type === "spec"
          ? "border-violet-300 bg-violet-50 text-violet-900"
          : p.type === "period-label"
            ? "border-accent/40 bg-accent/10 text-accent-dim"
            : p.type === "namespaced"
              ? "border-border bg-bg-elev text-text-dim"
              : "border-border bg-bg-card text-text-dim";

  return (
    <Tooltip
      inline
      content={`${p.raw}${p.label !== p.raw ? `\n→ ${p.label}` : ""}`}
      force
    >
      <span
        className={`inline-flex h-[18px] max-w-full items-center gap-0.5 rounded border font-mono text-[9px] leading-none ${style}`}
      >
        <span className="px-1 truncate leading-none">
          {p.type === "freeform" ? p.raw : p.label}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="px-0.5 text-text-faint hover:text-bad shrink-0"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        )}
      </span>
    </Tooltip>
  );
}

export function TagsList({
  tags,
  onRemove,
  className = "",
  limit,
  nowrap = false,
}: {
  tags: string[];
  onRemove?: (tag: string) => void;
  className?: string;
  /** When set, show at most this many chips and a +N popover for the rest */
  limit?: number;
  nowrap?: boolean;
}) {
  if (!tags.length) return null;

  if (limit == null) {
    return (
      <div className={`flex flex-wrap gap-0.5 min-w-0 ${className}`}>
        {tags.map((t) => (
          <TagChip
            key={t}
            tag={t}
            onRemove={onRemove ? () => onRemove(t) : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <OverflowChips
      items={tags}
      limit={limit}
      nowrap={nowrap}
      className={className}
      panelTitle="All tags"
      empty={null}
      renderChip={(t) => (
        <TagChip
          key={t}
          tag={t}
          onRemove={onRemove ? () => onRemove(t) : undefined}
        />
      )}
    />
  );
}
