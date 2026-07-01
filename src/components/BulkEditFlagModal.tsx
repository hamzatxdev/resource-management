"use client";

import { useEffect, useState } from "react";
import { FLAG_SEVERITIES, flagFromManualInput } from "@/lib/aiFlags";
import type { AiFlag, FlagSeverity } from "@/lib/types";
import { Modal, ModalButton, ModalField, modalSelectClass, modalTextareaClass } from "./Modal";

const SEVERITY_HELP: Record<FlagSeverity, string> = {
  none: "Clear — no flag",
  ok: "Reviewed — no concerns",
  info: "Informational note",
  watch: "Needs review / follow-up",
  action: "Urgent staffing action",
  replacement: "Should be replaced on project",
};

export function BulkEditFlagModal({
  open,
  onClose,
  count,
  previewNames,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  previewNames: string[];
  onSave: (flag: AiFlag) => Promise<void>;
}) {
  const [severity, setSeverity] = useState<FlagSeverity>("none");
  const [summary, setSummary] = useState("");
  const [reasonsText, setReasonsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSeverity("none");
      setSummary("");
      setReasonsText("");
      setError("");
      setProgress("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setProgress(`Updating ${count}…`);
    try {
      const reasons = reasonsText
        .split(/\n/)
        .map((r) => r.trim())
        .filter(Boolean);
      const next = flagFromManualInput({ severity, summary, reasons });
      await onSave(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save flags");
    } finally {
      setSaving(false);
      setProgress("");
    }
  };

  const namePreview =
    previewNames.length > 0
      ? previewNames.join(", ") +
        (count > previewNames.length ? ` … +${count - previewNames.length} more` : "")
      : `${count} selected`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk edit flag"
      description={`Apply the same flag to ${count} selected ${count === 1 ? "person" : "people"}: ${namePreview}`}
      size="md"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            type="submit"
            form="bulk-edit-flag-form"
            disabled={saving || count === 0}
          >
            {saving ? progress || "Saving…" : `Apply to ${count}`}
          </ModalButton>
        </>
      }
    >
      <form
        id="bulk-edit-flag-form"
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <ModalField label="Severity">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FlagSeverity)}
            className={modalSelectClass}
          >
            {FLAG_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s} — {SEVERITY_HELP[s]}
              </option>
            ))}
          </select>
        </ModalField>

        <ModalField label="Summary">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="One-line staffing note (same for everyone)…"
            className={modalTextareaClass}
          />
        </ModalField>

        <ModalField label="Reasons (one per line)">
          <textarea
            value={reasonsText}
            onChange={(e) => setReasonsText(e.target.value)}
            rows={4}
            placeholder="Optional bullet reasons (same for everyone)…"
            className={modalTextareaClass}
          />
        </ModalField>

        {error && <p className="text-bad text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
