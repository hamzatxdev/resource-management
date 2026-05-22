"use client";

import { useEffect, useState } from "react";
import { FLAG_SEVERITIES, flagFromManualInput } from "@/lib/aiFlags";
import type { AiFlag, FlagSeverity } from "@/lib/types";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";

const SEVERITY_HELP: Record<FlagSeverity, string> = {
  none: "Clear — no flag",
  ok: "Reviewed — no concerns",
  info: "Informational note",
  watch: "Needs review / follow-up",
  action: "Urgent staffing action",
  replacement: "Should be replaced on project",
};

export function EditFlagModal({
  open,
  onClose,
  memberName,
  memberId,
  flag,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  memberName: string;
  memberId: string;
  flag: AiFlag;
  onSave: (flag: AiFlag) => Promise<void>;
}) {
  const [severity, setSeverity] = useState<FlagSeverity>("none");
  const [summary, setSummary] = useState("");
  const [reasonsText, setReasonsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSeverity(flag.severity ?? "none");
      setSummary(flag.summary ?? "");
      setReasonsText((flag.reasons ?? []).join("\n"));
      setError("");
    }
  }, [open, flag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const reasons = reasonsText
        .split(/\n/)
        .map((r) => r.trim())
        .filter(Boolean);
      const next = flagFromManualInput({ severity, summary, reasons });
      await onSave(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save flag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit flag"
      description={`${memberName} (${memberId}) — override AI staffing flag for this profile.`}
      size="md"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            type="submit"
            form="edit-flag-form"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save flag"}
          </ModalButton>
        </>
      }
    >
      <form id="edit-flag-form" onSubmit={handleSubmit} className="space-y-3">
        <ModalField label="Severity">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FlagSeverity)}
            className={`${modalInputClass} w-full`}
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
            placeholder="One-line staffing note…"
            className={`${modalInputClass} resize-y`}
          />
        </ModalField>

        <ModalField label="Reasons (one per line)">
          <textarea
            value={reasonsText}
            onChange={(e) => setReasonsText(e.target.value)}
            rows={4}
            placeholder="Optional bullet reasons…"
            className={`${modalInputClass} resize-y font-mono text-[11px]`}
          />
        </ModalField>

        {error && <p className="text-bad text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
