"use client";

import { useEffect, useState } from "react";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";
import type { EscalationEntry } from "@/lib/types";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function WorkflowEntriesModal({
  open,
  onClose,
  title,
  description,
  memberLabel,
  entries,
  onAdd,
  onDelete,
  onReassess,
  reassessBusy = false,
  addPlaceholder = "Add a new entry…",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  memberLabel: string;
  entries: EscalationEntry[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReassess?: (entry: EscalationEntry) => Promise<void>;
  reassessBusy?: boolean;
  addPlaceholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft("");
  }, [open]);

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onAdd(text);
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`${memberLabel} — ${description}`}
      size="lg"
      footer={
        <ModalButton onClick={onClose}>Close</ModalButton>
      }
    >
      <div className="space-y-4">
        <div className="rounded border border-border bg-bg-elev/50 p-3 space-y-2">
          <ModalField label="Add new">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={addPlaceholder}
              className={`${modalInputClass} resize-y`}
            />
          </ModalField>
          <ModalButton
            variant="primary"
            onClick={handleAdd}
            disabled={!draft.trim() || saving}
          >
            {saving ? "Adding…" : "Add entry"}
          </ModalButton>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase text-text-faint mb-2">
            History ({sorted.length})
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-text-dim py-4 text-center border border-dashed border-border rounded">
              No entries yet.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[min(45vh,400px)] overflow-y-auto pr-1">
              {sorted.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded border border-border bg-bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <time className="font-mono text-[10px] text-text-faint shrink-0">
                      {formatDate(entry.createdAt)}
                    </time>
                    <div className="flex gap-1 shrink-0">
                      {onReassess && (
                        <button
                          type="button"
                          disabled={reassessBusy}
                          onClick={() => onReassess(entry)}
                          className="rounded border border-accent/50 bg-accent/10 px-2 py-0.5 text-[10px] text-accent hover:bg-accent/20 disabled:opacity-40"
                        >
                          {reassessBusy ? "AI…" : "Reassess"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === entry.id}
                        onClick={() => handleDelete(entry.id)}
                        className="rounded border border-bad/40 px-2 py-0.5 text-[10px] text-bad hover:bg-red-50 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-text whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {entry.text}
                  </p>
                  {entry.assessment && (
                    <div className="mt-2 pt-2 border-t border-border-soft">
                      <p className="text-[10px] text-text-faint uppercase mb-0.5">
                        AI assessment
                        {entry.appliedAt
                          ? ` · ${formatDate(entry.appliedAt)}`
                          : ""}
                      </p>
                      <p className="text-xs text-text-dim">{entry.assessment}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
