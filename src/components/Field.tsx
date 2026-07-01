"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/** Polished field styles — standard Tailwind only (no CSS-var utilities). */

export const inputClassName =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] leading-snug text-slate-900 shadow-sm placeholder:text-slate-400 transition-[border-color,box-shadow] focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const selectClassName = [
  inputClassName,
  "appearance-none cursor-pointer bg-white pr-10",
  "bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat",
  "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
].join(" ");

export const textareaClassName = `${inputClassName} min-h-[7rem] resize-y py-3`;

export const textareaSmClassName = `${inputClassName} min-h-[4.5rem] resize-y py-2.5 text-sm`;

export const inputCellClassName =
  "block w-full min-w-0 rounded-lg border border-blue-400 bg-white px-3 py-2 text-sm text-slate-900 shadow-lg ring-4 ring-blue-500/15 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20";

export const labelClassName = "block text-sm font-medium text-slate-600";

function mergeClass(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function FieldLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <span className={mergeClass(labelClassName, className)} {...(htmlFor ? { id: `${htmlFor}-label` } : {})}>
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={mergeClass("flex flex-col gap-1.5", className)}>
      {label ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : null}
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input ref={ref} className={mergeClass(inputClassName, className)} {...props} />
    );
  }
);

Input.displayName = "Input";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={mergeClass(selectClassName, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={mergeClass(textareaClassName, className)} {...props} />;
}

export function TextareaSm({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={mergeClass(textareaSmClassName, className)} {...props} />
  );
}

export function InputCell({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={mergeClass(inputCellClassName, className)} {...props} />;
}

/** @deprecated Use inputClassName or <Input /> */
export const uiInput = inputClassName;
export const uiSelect = selectClassName;
export const uiTextarea = textareaClassName;
export const uiTextareaSm = textareaSmClassName;
export const uiInputEdit = inputCellClassName;
export const uiLabel = labelClassName;
