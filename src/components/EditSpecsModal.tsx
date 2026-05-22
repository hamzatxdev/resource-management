"use client";

import { useEffect, useState } from "react";
import { GRANULAR_SPEC_PRESETS } from "@/lib/specializations";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";

export function EditSpecsModal({
  open,
  onClose,
  memberName,
  memberId,
  specializations,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  memberName: string;
  memberId: string;
  specializations: string[];
  onSave: (specs: string[]) => Promise<void>;
}) {
  const [specs, setSpecs] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSpecs([...specializations]);
  }, [open, specializations]);

  const toggle = (s: string) => {
    setSpecs((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const addCustom = () => {
    const t = custom.trim();
    if (t && !specs.includes(t)) {
      setSpecs((prev) => [...prev, t]);
      setCustom("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(specs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Specializations"
      description={`${memberName} (${memberId}) — select multiple granular tracks. Also add spec: tags (e.g. spec:full-stack:node).`}
      size="md"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        <div className="flex flex-wrap gap-1">
          {GRANULAR_SPEC_PRESETS.filter((s) => s !== "Profile Pending").map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                  specs.includes(s)
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-text-dim hover:border-accent"
                }`}
              >
                {s}
              </button>
            )
          )}
        </div>

        <ModalField label="Custom specialization">
          <div className="flex gap-1">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="e.g. Full Stack (Node)"
              className={modalInputClass}
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded border border-border px-2 text-xs hover:border-accent"
            >
              Add
            </button>
          </div>
        </ModalField>

        {specs.length > 0 && (
          <div>
            <p className="font-mono text-[10px] text-text-faint mb-1">Selected</p>
            <div className="flex flex-wrap gap-1">
              {specs.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                >
                  {s} ×
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
