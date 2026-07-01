"use client";

import { useMemo, useState } from "react";
import { parseSkillsInput } from "@/lib/skills";
import { RATING_STEPS } from "@/lib/inferRatings";
import { uiBtn, uiTextarea } from "@/lib/ui";
import { RatingBadge } from "./RatingBadge";
import { Tooltip } from "./Tooltip";
import type { TeamMemberClient } from "@/lib/types";

type AiSuggestion = {
  skills: string[];
  ratingUpdates: Record<string, number>;
  summary: string;
};

export function SkillEditor({
  member,
  onUpdate,
  onRateAll,
  onMemberRefresh,
}: {
  member: TeamMemberClient;
  onUpdate: (patch: Record<string, unknown>) => Promise<unknown>;
  onRateAll?: () => void;
  onMemberRefresh?: (member: TeamMemberClient) => void;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiSelected, setAiSelected] = useState<Set<string>>(new Set());

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

  const suggestWithAi = async () => {
    setAiLoading(true);
    setAiError("");
    setAiSuggestion(null);
    try {
      const res = await fetch("/api/ai/suggest-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI suggestion failed");

      const skills = (data.skills as string[]) ?? [];
      const ratingUpdates =
        (data.ratingUpdates as Record<string, number>) ?? {};
      const summary = String(data.summary ?? "");

      if (!skills.length) {
        setAiError(
          summary || "AI found no additional skills to suggest for this profile."
        );
        return;
      }

      setAiSuggestion({ skills, ratingUpdates, summary });
      setAiSelected(new Set(skills));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI suggestion failed");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleAiSkill = (skill: string) => {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const applyAiSkills = async () => {
    if (!aiSuggestion) return;
    const skills = aiSuggestion.skills.filter((s) => aiSelected.has(s));
    if (!skills.length) return;

    setAiSaving(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/suggest-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: member.id,
          save: true,
          skills,
          ratingUpdates: aiSuggestion.ratingUpdates,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add skills");

      if (data.member) {
        onMemberRefresh?.(data.member as TeamMemberClient);
      }
      setAiSuggestion(null);
      setAiSelected(new Set());
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to add skills");
    } finally {
      setAiSaving(false);
    }
  };

  const selectedAiCount = aiSuggestion
    ? aiSuggestion.skills.filter((s) => aiSelected.has(s)).length
    : 0;

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
        <button
          type="button"
          onClick={() => void suggestWithAi()}
          disabled={aiLoading || aiSaving}
          className="rounded border border-violet-300 bg-violet-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
        >
          {aiLoading ? "Suggesting…" : "Suggest skills (AI)"}
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

      {aiError && (
        <p className="text-xs text-bad rounded border border-red-200 bg-red-50 px-2.5 py-1.5">
          {aiError}
        </p>
      )}

      {aiSuggestion && (
        <div className="ui-panel space-y-2 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-violet-700">AI skill suggestions</p>
              {aiSuggestion.summary && (
                <p className="text-text-dim mt-0.5 max-w-3xl">{aiSuggestion.summary}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAiSelected(new Set(aiSuggestion.skills))}
                className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-accent"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setAiSelected(new Set())}
                className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-accent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiSuggestion(null);
                  setAiSelected(new Set());
                }}
                className="rounded border border-border px-2 py-0.5 text-[10px] text-text-dim"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 max-h-[min(40vh,20rem)] overflow-y-auto">
            {aiSuggestion.skills.map((skill) => {
              const checked = aiSelected.has(skill);
              const rating = aiSuggestion.ratingUpdates[skill];
              return (
                <label
                  key={skill}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] cursor-pointer ${
                    checked
                      ? "border-violet-300 bg-violet-50 text-violet-900"
                      : "border-border bg-bg-elev text-text-dim"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAiSkill(skill)}
                    className="accent-violet-600 size-3"
                  />
                  <span className="max-w-[180px] truncate">{skill}</span>
                  {rating != null && <RatingBadge rating={rating} />}
                </label>
              );
            })}
          </div>

          <button
            type="button"
            disabled={selectedAiCount === 0 || aiSaving}
            onClick={() => void applyAiSkills()}
            className={`${uiBtn.soft} text-xs py-1.5 h-auto`}
          >
            {aiSaving
              ? "Adding…"
              : selectedAiCount === 1
                ? "Add 1 skill with AI ratings"
                : `Add ${selectedAiCount} skills with AI ratings`}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1 max-h-[min(50vh,28rem)] overflow-y-auto">
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
        <div className="ui-panel text-xs">
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
          className={uiTextarea}
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
          className={`${uiBtn.soft} text-xs py-1.5 h-auto`}
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
