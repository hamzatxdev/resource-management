"use client";

import { useEffect, useId, useRef } from "react";
import {
  Field,
  inputClassName,
  labelClassName,
  selectClassName,
  textareaClassName,
} from "@/components/Field";
import { uiBtn } from "@/lib/ui";

export const modalInputClass = inputClassName;
export const modalSelectClass = selectClassName;
export const modalTextareaClass = textareaClassName;

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
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("input,textarea,select,button")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const width =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${width} max-h-[90vh] flex flex-col ui-card shadow-card-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p className="text-slate-500 text-sm mt-1.5 line-clamp-2">{description}</p>
          )}
        </div>

        {children && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        )}

        {footer && (
          <div className="shrink-0 flex justify-end gap-2 border-t border-slate-200 px-5 py-4 bg-slate-50">
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
  const styles =
    variant === "primary"
      ? uiBtn.primary
      : variant === "danger"
        ? "ui-btn border border-red-200 bg-red-50 text-bad hover:bg-red-100"
        : uiBtn.default;

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className={styles}
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
    <Field label={label} className="gap-2">
      {children}
    </Field>
  );
}

export { labelClassName as uiLabel };
