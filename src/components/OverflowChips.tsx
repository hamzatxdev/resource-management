"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

/** Shared height for table chips and +N control */
export const CHIP_ROW_H =
  "h-[18px] min-h-[18px] inline-flex items-center leading-none";

export function OverflowChips<T extends string>({
  items,
  limit = 1,
  renderChip,
  empty = <span className="text-text-faint text-[10px]">—</span>,
  className = "",
  panelTitle,
  nowrap = false,
}: {
  items: T[];
  limit?: number;
  renderChip: (item: T) => React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  panelTitle?: string;
  /** Keep chips and +N on one row (table cells) */
  nowrap?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: Placement;
  } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const visible = items.slice(0, limit);
  const hidden = items.slice(limit);
  const hasOverflow = hidden.length > 0;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const pad = 8;
    const panelH = panel?.offsetHeight ?? 0;
    const panelW = panel?.offsetWidth ?? 280;

    let placement: Placement = "bottom";
    let top = rect.bottom + gap;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;

    if (panelH > 0 && spaceBelow < panelH + pad && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - gap - panelH;
    } else if (panelH === 0 && spaceBelow < 120 && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - gap - 80;
    }

    let left = rect.left;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - panelW - pad);
    }
    if (left < pad) left = pad;

    setCoords({ top, left, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, items.length, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => updatePosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        anchorRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return <>{empty}</>;

  const panel =
    open && mounted ? (
      <div
        ref={panelRef}
        role="dialog"
        className="fixed z-[210] rounded border border-border bg-bg-card shadow-card-lg p-2 max-h-48 overflow-y-auto"
        style={{
          top: coords?.top ?? 0,
          left: coords?.left ?? 0,
          minWidth: 160,
          maxWidth: 300,
          visibility: coords ? "visible" : "hidden",
        }}
      >
        {panelTitle && (
          <p className="font-mono text-[9px] text-text-faint uppercase tracking-wider mb-1.5 px-0.5">
            {panelTitle}
          </p>
        )}
        <div className="flex flex-wrap gap-0.5">{hidden.map((item) => renderChip(item))}</div>
      </div>
    ) : null;

  return (
    <>
      <div
        className={`flex items-center gap-0.5 min-w-0 ${CHIP_ROW_H} ${
          nowrap ? "flex-nowrap" : "flex-wrap"
        } ${className}`}
      >
        {visible.map((item) => (
          <span
            key={item}
            className={`shrink min-w-0 max-w-full ${CHIP_ROW_H}`}
          >
            {renderChip(item)}
          </span>
        ))}
        {hasOverflow && (
          <button
            ref={anchorRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className={`shrink-0 rounded border border-border bg-bg-elev px-1 font-mono text-[9px] text-accent hover:border-accent/50 ${CHIP_ROW_H}`}
            aria-expanded={open}
            aria-label={`Show ${hidden.length} more`}
          >
            +{hidden.length}
          </button>
        )}
      </div>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
