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

export function Tooltip({
  content,
  children,
  className = "",
  maxWidth = 320,
  force = false,
  inline = false,
}: {
  content: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: number;
  /** Always show styled tooltip on hover (e.g. tags/skills lists) */
  force?: boolean;
  /** Use inline-flex so chips align in a horizontal row */
  inline?: boolean;
}) {
  const text = (content ?? "").trim();
  const hasContent = text.length > 0;

  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: Placement;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const checkTruncation = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  const visible =
    hasContent && show && (force || truncated || text.length > 36);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 6;
    const tipH = tip?.offsetHeight ?? 0;
    const tipW = tip?.offsetWidth ?? maxWidth;
    const pad = 8;

    let placement: Placement = "bottom";
    let top = rect.bottom + gap;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;

    if (tipH > 0 && spaceBelow < tipH + pad && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - gap - tipH;
    } else if (tipH === 0 && spaceBelow < 140 && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - gap - 80;
    }

    let left = rect.left;
    if (left + tipW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - tipW - pad);
    }
    if (left < pad) left = pad;

    setCoords({ top, left, placement });
  }, [maxWidth]);

  useLayoutEffect(() => {
    if (!visible) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [visible, text, maxWidth, updatePosition]);

  useEffect(() => {
    if (!visible) return;
    const onMove = () => updatePosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [visible, updatePosition]);

  if (!hasContent) {
    return <>{children}</>;
  }

  const tipEl = visible ? (
    <span
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none fixed z-[200] rounded border border-border bg-bg-elev px-2.5 py-1.5 text-xs text-text shadow-card-lg leading-snug whitespace-pre-wrap break-words"
      style={{
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        maxWidth,
        visibility: coords ? "visible" : "hidden",
      }}
    >
      {text}
    </span>
  ) : null;

  const wrapClass = inline
    ? `relative inline-flex items-center max-w-full min-w-0 align-middle ${className}`
    : `relative block max-w-full min-w-0 ${className}`;
  const innerClass = inline
    ? "inline-flex items-center min-w-0 max-w-full"
    : "block min-w-0 truncate";

  return (
    <>
      <span
        ref={anchorRef}
        className={wrapClass}
        onMouseEnter={() => {
          checkTruncation();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        onFocus={() => {
          checkTruncation();
          setShow(true);
        }}
        onBlur={() => setShow(false)}
      >
        <span className={innerClass}>{children}</span>
      </span>
      {mounted && tipEl ? createPortal(tipEl, document.body) : null}
    </>
  );
}
