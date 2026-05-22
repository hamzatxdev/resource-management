"use client";

import { useEffect, useState } from "react";
import { TAG_EXAMPLES } from "@/lib/tags";
import { TagsList } from "./TagChip";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";
import type { TeamMemberClient } from "@/lib/types";

interface GeneratedProfile {
  id: string;
  name: string;
  role: string;
  exp: string;
  email: string;
  stackLabel: string;
  skills: string[];
  tags: string[];
  projects: string[];
  specializations?: string[];
  notes: string;
}

interface TagLabel {
  raw: string;
  label: string;
  type: string;
}

export function GenerateProfileModal({
  open,
  onClose,
  defaultId = "",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultId?: string;
  onSaved: (member: TeamMemberClient) => void;
}) {
  const [id, setId] = useState(defaultId);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GeneratedProfile | null>(null);
  const [tagLabels, setTagLabels] = useState<TagLabel[]>([]);

  useEffect(() => {
    if (open) {
      setId(defaultId);
      setNotes("");
      setPreview(null);
      setTagLabels([]);
      setError("");
    }
  }, [open, defaultId]);

  const generate = async (save: boolean) => {
    if (!id.trim() || !notes.trim()) {
      setError("Employee ID and notes are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), notes, save }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setPreview(data.profile);
      setTagLabels(data.tagLabels ?? []);

      if (save && data.member) {
        onSaved(data.member);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI generate profile"
      description="Enter an employee ID and describe the person — skills, allocations, bench time, projects. AI builds the profile and structured tags."
      size="lg"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalButton
            onClick={() => generate(false)}
            disabled={loading}
          >
            {loading ? "Working…" : "Preview"}
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => generate(true)}
            disabled={loading}
          >
            {loading ? "Saving…" : "Generate & save"}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-3">
        <ModalField label="Employee ID *">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="TV-00999"
            className={`${modalInputClass} font-mono`}
          />
        </ModalField>

        <ModalField label="Information for AI *">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder={`Example:\nSenior MERN engineer, 5 years exp.\nMay on bench. June allocated to CIS project 4 hours per day.\nSkills: React, Node, MongoDB, AWS...`}
            className={`${modalInputClass} resize-y`}
          />
        </ModalField>

        <div className="rounded border border-border bg-bg-elev/50 p-2">
          <p className="font-mono text-[10px] text-text-faint mb-1">
            Tag examples (AI will use similar formats)
          </p>
          <div className="flex flex-wrap gap-1">
            {TAG_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() =>
                  setNotes((n) => (n ? `${n}\nTag: ${ex}` : `Tag: ${ex}`))
                }
                className="font-mono text-[9px] rounded border border-border px-1.5 py-0.5 hover:border-accent"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-bad text-xs">{error}</p>}

        {preview && (
          <div className="rounded border border-border p-3 space-y-2 text-sm max-h-[40vh] overflow-y-auto">
            <p className="font-display text-lg">
              {preview.name || "—"}{" "}
              <span className="font-mono text-text-faint text-sm">{preview.id}</span>
            </p>
            <p>
              <span className="text-text-faint">Role:</span> {preview.role || "—"} ·{" "}
              <span className="text-text-faint">Exp:</span> {preview.exp || "—"}
            </p>
            <p>
              <span className="text-text-faint">Email:</span> {preview.email || "—"}
            </p>
            <p>
              <span className="text-text-faint">Stack:</span> {preview.stackLabel || "—"}
            </p>
            {preview.specializations && preview.specializations.length > 0 && (
              <p>
                <span className="text-text-faint">Specializations:</span>{" "}
                {preview.specializations.join(", ")}
              </p>
            )}
            {preview.tags.length > 0 && (
              <div>
                <p className="text-text-faint text-xs mb-1">Tags (readable)</p>
                <TagsList tags={preview.tags} />
              </div>
            )}
            {preview.skills.length > 0 && (
              <p>
                <span className="text-text-faint">Skills:</span>{" "}
                {preview.skills.join(", ")}
              </p>
            )}
            {preview.projects.length > 0 && (
              <p>
                <span className="text-text-faint">Projects:</span>{" "}
                {preview.projects.join(", ")}
              </p>
            )}
            {preview.notes && (
              <p className="text-text-dim text-xs border-t border-border-soft pt-2">
                {preview.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
