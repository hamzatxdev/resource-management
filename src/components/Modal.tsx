"use client";

import { useEffect, useId, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const width =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${width} rounded-lg border border-border bg-bg-card shadow-card-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id={titleId} className="font-display text-xl text-text">
            {title}
          </h2>
          {description && (
            <p className="text-text-dim text-sm mt-1">{description}</p>
          )}
        </div>

        {children && <div className="px-4 py-4">{children}</div>}

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalButton({
  variant = "default",
  onClick,
  disabled,
  children,
  type = "button",
  form,
}: {
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  type?: "button" | "submit";
  form?: string;
}) {
  const base =
    "rounded border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25"
      : variant === "danger"
        ? "border-bad/50 bg-bad/10 text-bad hover:bg-bad/20"
        : "border-border text-text-dim hover:border-text-dim hover:text-text";

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}

export function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

export const modalInputClass =
  "w-full rounded border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/25";
