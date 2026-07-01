"use client";

import { useState } from "react";
import { Textarea, TextareaSm } from "@/components/Field";
import { uiBtn } from "@/lib/ui";

export function AiPanel({
  onApplyFilter,
  activeFilterCount = 0,
  aiFilterActive = false,
  onClearFilter,
}: {
  onApplyFilter: (memberIds: string[], summary: string) => void;
  activeFilterCount?: number;
  aiFilterActive?: boolean;
  onClearFilter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [matcherInput, setMatcherInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const ask = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, matcherInput, filterOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI failed");

      const ids: string[] = data.memberIds ?? [];
      const count = ids.length;
      if (count === 0) {
        setStatus(
          "No matches. Try reindexing profiles, or broaden your question / matcher."
        );
        onApplyFilter([], "0 matches");
        return;
      }

      const mode = data.filterMode as string | undefined;
      const nlSummary = data.filterSummary as string | undefined;
      const summary =
        nlSummary ??
        (mode === "tags"
          ? `${count} matches (tags)`
          : matcherInput.trim() && message.trim()
            ? `${count} matches (skills + search)`
            : matcherInput.trim()
              ? `${count} skill matches`
              : `${count} matches`);

      onApplyFilter(ids, summary);
      setStatus(
        mode === "tags"
          ? `Table filtered by tags (${count} ${count === 1 ? "person" : "people"}).`
          : `Table filtered to ${count} ${count === 1 ? "person" : "people"}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI error");
    } finally {
      setLoading(false);
    }
  };

  const reindex = async () => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/ai/reindex", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reindex failed");
      setStatus(`Re-indexed ${data.indexed}/${data.total} profiles for search.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reindex error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className={`flex flex-col ui-card overflow-hidden transition-all duration-300 min-h-0 ${
        open ? "w-full lg:w-72 shrink-0" : "w-11 shrink-0"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-50 text-sm font-semibold text-blue-700"
      >
        {open ? "AI filter" : "AI"}
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="flex flex-col flex-1 p-4 gap-4 min-h-0 overflow-hidden">
          <p className="text-sm text-slate-500 leading-relaxed">
            Natural language → tag filters. Skill questions use semantic search.
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void ask();
              }
            }}
            placeholder="Who is on bench? Replacement but not bench. SSE on CIS…"
            rows={4}
            className="min-h-[6rem]"
          />
          <TextareaSm
            value={matcherInput}
            onChange={(e) => setMatcherInput(e.target.value)}
            placeholder="Matcher: React.js:4, Node.js:4"
            rows={2}
            className="font-mono"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={ask}
              disabled={loading}
              className={`flex-1 ${uiBtn.primary}`}
            >
              {loading ? "Searching…" : "Filter table"}
            </button>
            <button
              type="button"
              onClick={reindex}
              disabled={loading}
              title="Rebuild embeddings for all profiles"
              className={uiBtn.default}
            >
              Reindex
            </button>
          </div>

          {aiFilterActive && onClearFilter && (
            <button
              type="button"
              onClick={() => {
                onClearFilter();
                setStatus("");
              }}
              className="text-sm text-blue-600 hover:underline text-left font-medium"
            >
              Clear AI filter ({activeFilterCount})
            </button>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {status && (
            <p className="text-sm text-slate-500 leading-relaxed">{status}</p>
          )}
        </div>
      )}
    </aside>
  );
}
