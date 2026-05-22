"use client";

import { useState } from "react";
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
  const [newSkill, setNewSkill] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const setRating = async (skill: string, value: number | null) => {
    await onUpdate({ skillRating: { skill, value } });
    setEditing(null);
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

      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
        {member.skills.map((skill) => {
          const ai = member.aiRatings[skill];
          const rating = member.ratings[skill] ?? ai;
          const overridden = member.ratingOverrides[skill] != null;
          return (
            <button
              key={skill}
              type="button"
              onClick={() => setEditing(skill)}
              className="inline-flex items-center gap-1 rounded border border-border bg-bg-elev px-1.5 py-0.5 font-mono text-[10px] hover:border-accent/50"
            >
              <Tooltip content={skill}>
                <span className="text-text-dim max-w-[140px] truncate inline-block">
                  {skill}
                </span>
              </Tooltip>
              <RatingBadge rating={rating} overridden={overridden} />
            </button>
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
              onClick={() => onUpdate({ removeSkill: editing }).then(() => setEditing(null))}
              className="rounded border border-bad/50 px-2 py-0.5 text-bad"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSkill.trim()) {
              onUpdate({ addSkill: newSkill.trim() }).then(() => setNewSkill(""));
            }
          }}
          placeholder="Add skill…"
          className="flex-1 rounded border border-border bg-bg-elev px-2 py-1 font-mono text-[11px] outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!newSkill.trim()}
          onClick={() =>
            onUpdate({ addSkill: newSkill.trim() }).then(() => setNewSkill(""))
          }
          className="rounded border border-border px-2 py-1 text-[11px] hover:border-accent disabled:opacity-40"
        >
          +
        </button>
      </div>

    </div>
  );
}
