import type { ButtonHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

export type ToolbarTone =
  | "import"
  | "exportExcel"
  | "exportJson"
  | "assessAll"
  | "assessFiltered"
  | "assessSelected"
  | "aiProfile"
  | "setFlag"
  | "clear"
  | "addPerson"
  | "refresh"
  | "logout";

const ICONS: Record<ToolbarTone, ReactNode> = {
  import: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M10 2a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 10.586V3a1 1 0 0 1 1-1Z" />
      <path d="M3 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  exportExcel: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.414A2 2 0 0 0 16.414 6L12 1.586A2 2 0 0 0 10.586 1H4Zm8 0v4a1 1 0 0 0 1 1h4v9H4V3h8Z" />
      <path d="M7 9h6v1.5H7V9Zm0 2.5h6V13H7v-1.5Zm0 2.5h4V15H7v-1Z" />
    </svg>
  ),
  exportJson: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M6 3a1 1 0 0 0-1 1v1.05A3.001 3.001 0 0 0 4 8v4a3 3 0 0 0 1 2.95V16a1 1 0 1 0 2 0v-1.05A3.001 3.001 0 0 0 8 12V8a3 3 0 0 0-1-2.95V4a1 1 0 0 0-1-1Zm8 0a1 1 0 0 1 1 1v1.05A3.001 3.001 0 0 1 16 8v4a3 3 0 0 1-1 2.95V16a1 1 0 1 1-2 0v-1.05A3.001 3.001 0 0 1 12 12V8a3 3 0 0 1 1-2.95V4a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  assessAll: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
    </svg>
  ),
  assessFiltered: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 .832 1.555l-4.182 6.273V15a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 6 17v-5.172L1.168 5.555A1 1 0 0 1 3 4Z" />
    </svg>
  ),
  assessSelected: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Zm3 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6Zm7 0a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-1ZM6 10a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H6Zm7 0a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1Z" />
    </svg>
  ),
  aiProfile: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 16a6 6 0 1 1 12 0H4Z" />
      <path d="M14.5 6.5a.75.75 0 0 1 1.06 0l1 1a.75.75 0 1 1-1.06 1.06l-1-1a.75.75 0 0 1 0-1.06Z" />
    </svg>
  ),
  setFlag: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M3 3a1 1 0 0 1 1-1h2.153a1 1 0 0 1 .986.836l.74 4.435a1 1 0 0 0 .986.836H16a1 1 0 0 1 .894 1.447l-3.5 7A1 1 0 0 1 12.5 17H9.236a1 1 0 0 1-.948-.684l-1.498-4.493-1.15 3.447A1 1 0 0 1 4.5 15H3a1 1 0 0 1-1-1V3Z" />
    </svg>
  ),
  clear: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  ),
  addPerson: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M4 4a1 1 0 0 1 1.527-.852l8 4.5a1 1 0 0 1 0 1.704l-8 4.5A1 1 0 0 1 4 13.5V11H2a1 1 0 0 1 0-2h2V4Zm11.5 1.5a6.5 6.5 0 1 1-2.2 4.9.75.75 0 1 1 1.2-.9 5 5 0 1 0 1.6-3.75.75.75 0 1 1 1.5-.25Z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
      <path d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" />
      <path d="M14.53 9.47a.75.75 0 0 0-1.06 0l-1.72 1.72V10a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 .75.75h3a.75.75 0 0 0 0-1.5h-1.19l1.72-1.72a.75.75 0 0 0 0-1.06Z" />
    </svg>
  ),
};

function toneClass(tone: ToolbarTone): string {
  return `ui-action-btn ui-action-btn-${tone}`;
}

export function ToolbarButton({
  tone,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: ToolbarTone;
}) {
  return (
    <button type="button" className={`${toneClass(tone)} ${className}`.trim()} {...props}>
      <span className="ui-action-btn-icon" aria-hidden>
        {ICONS[tone]}
      </span>
      <span className="ui-action-btn-label">{children}</span>
    </button>
  );
}

export function ToolbarLabel({
  tone,
  children,
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
  tone: ToolbarTone;
}) {
  return (
    <label className={`${toneClass(tone)} cursor-pointer ${className}`.trim()} {...props}>
      <span className="ui-action-btn-icon" aria-hidden>
        {ICONS[tone]}
      </span>
      <span className="ui-action-btn-label">{children}</span>
    </label>
  );
}
