"use client";

import { useState } from "react";
import { EditableTextarea } from "./EditableTextarea";
import { Tooltip } from "./Tooltip";
import type { EscalationEntry, TeamMemberClient } from "@/lib/types";

export function EscalationCell({
  member,
  onAddEscalation,
  onReassess,
  busy,
}: {
  member: TeamMemberClient;
  onAddEscalation: (text: string) => Promise<void>;
  onReassess: (escalationText: string) => Promise<void>;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const latest = member.escalations?.[member.escalations.length - 1];

  return (
    <div className="space-y-1 min-w-0">
      {latest && (
        <Tooltip
          content={`${latest.text}${latest.assessment ? `\n\nAI: ${latest.assessment}` : ""}`}
          force
          maxWidth={400}
        >
          <p className="text-[9px] text-text-dim line-clamp-2 font-mono">
            {latest.text}
          </p>
        </Tooltip>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add escalation…"
        rows={2}
        className="w-full rounded border border-border bg-bg-elev px-1.5 py-1 font-mono text-[10px] outline-none focus:border-accent resize-y"
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!draft.trim() || busy}
          onClick={async () => {
            await onAddEscalation(draft.trim());
            setDraft("");
          }}
          className="rounded border border-border px-1.5 py-0.5 text-[9px] hover:border-accent disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy || (!draft.trim() && !latest?.text)}
          onClick={() => onReassess(draft.trim() || latest?.text || "")}
          className="rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent hover:bg-accent/20 disabled:opacity-40"
        >
          {busy ? "AI…" : "Reassess"}
        </button>
      </div>
      {member.escalations && member.escalations.length > 1 && (
        <span className="text-[9px] text-text-faint">
          {member.escalations.length} escalations
        </span>
      )}
    </div>
  );
}
