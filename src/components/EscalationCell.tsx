"use client";

import { useState } from "react";
import { TextareaSm } from "@/components/Field";
import { uiBtn } from "@/lib/ui";
import { Tooltip } from "./Tooltip";
import type { TeamMemberClient } from "@/lib/types";

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
    <div className="space-y-2 min-w-0">
      {latest && (
        <Tooltip
          content={`${latest.text}${latest.assessment ? `\n\nAI: ${latest.assessment}` : ""}`}
          force
          maxWidth={400}
        >
          <p className="text-sm text-slate-600 line-clamp-2">{latest.text}</p>
        </Tooltip>
      )}
      <TextareaSm
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add escalation…"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!draft.trim() || busy}
          onClick={async () => {
            await onAddEscalation(draft.trim());
            setDraft("");
          }}
          className={`${uiBtn.default} text-sm py-1.5 px-3 h-auto`}
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy || (!draft.trim() && !latest?.text)}
          onClick={() => onReassess(draft.trim() || latest?.text || "")}
          className={`${uiBtn.soft} text-sm py-1.5 px-3 h-auto`}
        >
          {busy ? "AI…" : "Reassess"}
        </button>
      </div>
      {member.escalations && member.escalations.length > 1 && (
        <span className="text-xs text-slate-400">
          {member.escalations.length} escalations
        </span>
      )}
    </div>
  );
}
