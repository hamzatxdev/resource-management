"use client";

import { useMemo, useState } from "react";
import { parseSkillsInput } from "@/lib/skills";
import { RATING_STEPS } from "@/lib/inferRatings";
import { RatingBadge } from "./RatingBadge";
import { Tooltip } from "./Tooltip";
import type { TeamMemberClient } from "@/lib/types";

export function SkillEditor({
  member,
  onUpdate,
  onRateAll,
}: {
  member: TeamMemberClient;
  onUpdate: (patch: Record<string, unknown>) => Promise<unknown>;
  onRateAll?: () => void;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const parsed = useMemo(() => parseSkillsInput(skillInput), [skillInput]);
  const existingLower = useMemo(
    () => new Set(member.skills.map((s) => s.toLowerCase())),
    [member.skills]
  );
  const toAdd = useMemo(
    () => parsed.filter((s) => !existingLower.has(s.toLowerCase())),
    [parsed, existingLower]
  );

  const setRating = async (skill: string, value: number | null) => {
    await onUpdate({ skillRating: { skill, value } });
    setEditing(null);
  };

  const addSkills = async () => {
    if (!toAdd.length) return;
    setAdding(true);
    try {
      await onUpdate({ addSkills: toAdd });
      setSkillInput("");
    } finally {
      setAdding(false);
    }
  };

  const removeSkill = async (skill: string) => {
    if (editing === skill) setEditing(null);
    await onUpdate({ removeSkill: skill });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-border-soft">
        <button
          type="button"
          onClick={() => onRateAll?.()}
          disabled={member.skills.length === 0}
          className="rounded border border-accent/50 bg-accent/10 px-2.5 py-1 font-mono text-[11px] text-accent hover:bg-accent/20 disabled:opacity-40"
        >
          Rate all skills…
        </button>
        <span className="font-mono text-[10px] text-text-faint">
          {member.skills.length} skills
          {Object.keys(member.ratingOverrides).length > 0 &&
            ` · ${Object.keys(member.ratingOverrides).length} overridden`}
        </span>
        <div className="flex gap-1 ml-auto">
          <span className="font-mono text-[9px] text-text-faint self-center">
            Quick set all:
          </span>
          {[3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdate({ setAllSkillRating: v })}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] hover:border-accent"
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onUpdate({ setAllSkillRating: null })}
            className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-dim hover:border-accent"
          >
            AI
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {member.skills.map((skill) => {
          const ai = member.aiRatings[skill];
          const rating = member.ratings[skill] ?? ai;
          const overridden = member.ratingOverrides[skill] != null;
          return (
            <span
              key={skill}
              className="inline-flex items-center gap-0.5 rounded border border-border bg-bg-elev font-mono text-[10px]"
            >
              <button
                type="button"
                onClick={() => setEditing(skill)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 hover:text-accent"
              >
                <Tooltip content={skill}>
                  <span className="text-text-dim max-w-[160px] truncate inline-block text-left">
                    {skill}
                  </span>
                </Tooltip>
                <RatingBadge rating={rating} overridden={overridden} />
              </button>
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="px-1 py-0.5 text-text-faint hover:text-bad shrink-0"
                aria-label={`Remove ${skill}`}
                title="Remove skill"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      {editing && (
        <div className="rounded border border-border bg-bg-elev p-2 text-xs shadow-sm">
          <p className="font-mono text-accent mb-1">{editing}</p>
          <p className="text-text-faint mb-2">
            AI: {member.aiRatings[editing]?.toFixed(1) ?? "—"}
          </p>
          <div className="flex flex-wrap gap-1">
            {RATING_STEPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRating(editing, v)}
                className="rounded border border-border px-2 py-0.5 hover:bg-accent/20"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRating(editing, null)}
              className="rounded border border-border px-2 py-0.5 text-text-dim"
            >
              Reset AI
            </button>
            <button
              type="button"
              onClick={() => removeSkill(editing)}
              className="rounded border border-bad/50 px-2 py-0.5 text-bad"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <textarea
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          placeholder={
            "AI, ML, RAG, Langchain, FastAPI, Django\nor one skill per line"
          }
          rows={3}
          className="w-full rounded border border-border bg-bg-elev px-2 py-1.5 font-mono text-[11px] outline-none focus:border-accent resize-y min-h-[4rem]"
        />
        {parsed.length > 0 && (
          <p className="text-[10px] text-text-faint">
            {toAdd.length > 0
              ? `Will add ${toAdd.length} new skill${toAdd.length === 1 ? "" : "s"}`
              : "All listed skills already on this profile"}
            {parsed.length > toAdd.length &&
              ` · skipping ${parsed.length - toAdd.length} duplicate${parsed.length - toAdd.length === 1 ? "" : "s"}`}
          </p>
        )}
        <button
          type="button"
          disabled={!toAdd.length || adding}
          onClick={addSkills}
          className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 text-[11px] text-accent hover:bg-accent/20 disabled:opacity-40"
        >
          {adding
            ? "Adding…"
            : toAdd.length > 1
              ? `Add ${toAdd.length} skills`
              : toAdd.length === 1
                ? "Add skill"
                : "Add skills"}
        </button>
      </div>
    </div>
  );
}
