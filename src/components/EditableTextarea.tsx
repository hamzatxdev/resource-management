"use client";

import { useEffect, useState } from "react";

export function EditableTextarea({
  value,
  onSave,
  placeholder,
  rows = 2,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      placeholder={placeholder}
      rows={rows}
      className={`w-full rounded border border-border bg-bg-elev px-1.5 py-1 font-mono text-[10px] text-text outline-none focus:border-accent resize-y min-h-[2.5rem] ${className}`}
    />
  );
}
