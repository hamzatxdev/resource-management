"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/Field";

export function EditableTextarea({
  value,
  onSave,
  placeholder,
  rows = 3,
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
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  );
}
