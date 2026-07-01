"use client";

import { useEffect, useMemo, useState } from "react";
import { RATING_STEPS } from "@/lib/inferRatings";
import { RatingBadge, ratingClass } from "./RatingBadge";
import { Modal, ModalButton, ModalField, modalInputClass, modalSelectClass } from "./Modal";
import type { TeamMemberClient } from "@/lib/types";

/** null = use AI rating (clear override) */
type DraftValue = number | null;

function draftFromMember(member: TeamMemberClient): Record<string, DraftValue> {
  const draft: Record<string, DraftValue> = {};
  for (const skill of member.skills) {
    draft[skill] =
      skill in member.ratingOverrides ? member.ratingOverrides[skill] : null;
  }
  return draft;
}

export function BulkRatingModal({
  open,
  onClose,
  member,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  member: TeamMemberClient;
  onSave: (ratings: Record<string, number | null>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, DraftValue>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(draftFromMember(member));
      setFilter("");
    }
  }, [open, member]);

  const filteredSkills = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return member.skills;
    return member.skills.filter((s) => s.toLowerCase().includes(q));
  }, [member.skills, filter]);

  const setAll = (value: DraftValue) => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const skill of member.skills) next[skill] = value;
      return next;
    });
  };

  const setSkill = (skill: string, value: DraftValue) => {
    setDraft((prev) => ({ ...prev, [skill]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number | null> = {};
      for (const skill of member.skills) {
        const chosen = draft[skill];
        const ai = member.aiRatings[skill];
        payload[skill] = chosen == null || chosen === ai ? null : chosen;
      }
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const overrideCount = member.skills.filter((s) => {
    const d = draft[s];
    const ai = member.aiRatings[s];
    return d != null && d !== ai;
  }).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rate all skills"
      description={`${member.name} (${member.id}) — set ratings for every skill in one place.`}
      size="lg"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save all ratings"}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="font-mono text-[10px] text-text-faint uppercase">
            Set all:
          </span>
          {RATING_STEPS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAll(v)}
              className={`rounded border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:bg-accent/10 ${ratingClass(v)}`}
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAll(null)}
            className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-dim hover:border-accent"
          >
            Reset all to AI
          </button>
        </div>

        <ModalField label="Filter skills">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search skills…"
            className={modalInputClass}
          />
        </ModalField>

        <div className="max-h-[min(50vh,420px)] overflow-y-auto rounded border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-bg-elev z-10 border-b border-border font-mono text-[10px] uppercase text-text-faint">
              <tr>
                <th className="px-3 py-2">Skill</th>
                <th className="px-2 py-2 w-14 text-center">AI</th>
                <th className="px-2 py-2 w-20 text-center">Your rating</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkills.map((skill) => {
                const ai = member.aiRatings[skill];
                const d = draft[skill];
                const isOverride = d != null && d !== ai;
                const displayRating = d ?? ai ?? 0;

                return (
                  <tr
                    key={skill}
                    className="border-b border-border-soft hover:bg-bg-card-hover"
                  >
                    <td className="px-3 py-1.5 font-mono text-text max-w-[200px] truncate">
                      {skill}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <RatingBadge rating={ai ?? 0} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={d == null ? "ai" : String(d)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSkill(skill, v === "ai" ? null : parseFloat(v));
                        }}
                        className={modalSelectClass}
                      >
                        <option value="ai">AI ({ai?.toFixed(1) ?? "—"})</option>
                        {RATING_STEPS.map((step) => (
                          <option key={step} value={step}>
                            {step}
                          </option>
                        ))}
                      </select>
                      {isOverride && (
                        <span className="block text-center mt-0.5">
                          <RatingBadge rating={displayRating} overridden />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredSkills.length === 0 && (
            <p className="p-4 text-center text-text-dim text-sm">No skills match.</p>
          )}
        </div>

        <p className="text-text-faint text-[11px] font-mono">
          {member.skills.length} skills · {overrideCount} overridden in this draft
        </p>
      </div>
    </Modal>
  );
}
