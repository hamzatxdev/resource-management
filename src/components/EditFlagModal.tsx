"use client";

import { useEffect, useState } from "react";
import { FLAG_SEVERITIES, flagFromManualInput } from "@/lib/aiFlags";
import { probationFromManualInput } from "@/lib/probation";
import type { AiFlag, FlagSeverity, ProbationFlag } from "@/lib/types";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";

const SEVERITY_HELP: Record<FlagSeverity, string> = {
  none: "Clear — no flag",
  ok: "Reviewed — no concerns",
  info: "Informational note",
  watch: "Needs review / follow-up",
  action: "Urgent staffing action",
  replacement: "Should be replaced on project",
};

type FlagTab = "staffing" | "probation";

export function EditFlagModal({
  open,
  onClose,
  memberName,
  memberId,
  flag,
  probation,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  memberName: string;
  memberId: string;
  flag: AiFlag;
  probation: ProbationFlag;
  onSave: (data: {
    aiFlags: AiFlag;
    probation: ProbationFlag;
  }) => Promise<void>;
}) {
  const [tab, setTab] = useState<FlagTab>("staffing");
  const [severity, setSeverity] = useState<FlagSeverity>("none");
  const [summary, setSummary] = useState("");
  const [reasonsText, setReasonsText] = useState("");
  const [probationActive, setProbationActive] = useState(false);
  const [probationSummary, setProbationSummary] = useState("");
  const [probationReasonsText, setProbationReasonsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTab(probation.active ? "probation" : "staffing");
      setSeverity(flag.severity ?? "none");
      setSummary(flag.summary ?? "");
      setReasonsText((flag.reasons ?? []).join("\n"));
      setProbationActive(Boolean(probation.active));
      setProbationSummary(probation.summary ?? "");
      setProbationReasonsText((probation.reasons ?? []).join("\n"));
      setError("");
    }
  }, [open, flag, probation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const reasons = reasonsText
        .split(/\n/)
        .map((r) => r.trim())
        .filter(Boolean);
      const probationReasons = probationReasonsText
        .split(/\n/)
        .map((r) => r.trim())
        .filter(Boolean);
      await onSave({
        aiFlags: flagFromManualInput({ severity, summary, reasons }),
        probation: probationFromManualInput({
          active: probationActive,
          summary: probationSummary,
          reasons: probationReasons,
          since: probationActive ? probation.since : undefined,
        }),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save flags");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit flags"
      description={`${memberName} (${memberId})`}
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
            {saving ? "Saving…" : "Save flags"}
          </ModalButton>
        </>
      }
    >
      <form id="edit-flag-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-1 p-0.5 rounded border border-border bg-bg-elev">
          <button
            type="button"
            onClick={() => setTab("staffing")}
            className={`flex-1 rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
              tab === "staffing"
                ? "bg-bg-card text-accent shadow-sm"
                : "text-text-dim hover:text-text"
            }`}
          >
            Staffing flag
          </button>
          <button
            type="button"
            onClick={() => setTab("probation")}
            className={`flex-1 rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
              tab === "probation"
                ? "bg-orange-50 text-orange-800 shadow-sm"
                : "text-text-dim hover:text-text"
            }`}
          >
            Probation
            {probationActive && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 align-middle" />
            )}
          </button>
        </div>

        {tab === "staffing" ? (
          <div className="space-y-2">
            <ModalField label="Severity">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as FlagSeverity)}
                className={`${modalInputClass} w-full py-1.5`}
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
                className={`${modalInputClass} resize-y min-h-[2.5rem]`}
              />
            </ModalField>

            <ModalField label="Reasons (one per line)">
              <textarea
                value={reasonsText}
                onChange={(e) => setReasonsText(e.target.value)}
                rows={2}
                placeholder="Optional…"
                className={`${modalInputClass} resize-y min-h-[2.5rem] font-mono text-[11px]`}
              />
            </ModalField>
          </div>
        ) : (
          <div className="space-y-2">
            <ModalField label="Status">
              <select
                value={probationActive ? "active" : "inactive"}
                onChange={(e) =>
                  setProbationActive(e.target.value === "active")
                }
                className={`${modalInputClass} w-full py-1.5 border-orange-200`}
              >
                <option value="inactive">Not on probation</option>
                <option value="active">On probation</option>
              </select>
            </ModalField>

            {probationActive && (
              <>
                <ModalField label="Summary">
                  <textarea
                    value={probationSummary}
                    onChange={(e) => setProbationSummary(e.target.value)}
                    rows={2}
                    placeholder="e.g. 90-day review…"
                    className={`${modalInputClass} resize-y min-h-[2.5rem]`}
                  />
                </ModalField>

                <ModalField label="Notes (one per line)">
                  <textarea
                    value={probationReasonsText}
                    onChange={(e) => setProbationReasonsText(e.target.value)}
                    rows={2}
                    placeholder="Optional…"
                    className={`${modalInputClass} resize-y min-h-[2.5rem] font-mono text-[11px]`}
                  />
                </ModalField>

                {probation.since && (
                  <p className="text-text-dim text-[10px] font-mono">
                    Started {new Date(probation.since).toLocaleDateString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {error && <p className="text-bad text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
