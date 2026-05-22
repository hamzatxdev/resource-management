"use client";

import { useState } from "react";

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
  const [open, setOpen] = useState(true);
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
      const summary =
        mode === "tags"
          ? `${count} matches (tags)`
          : matcherInput.trim() && message.trim()
            ? `${count} matches (skills + search)`
            : matcherInput.trim()
              ? `${count} skill matches`
              : `${count} matches`;

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
      className={`flex flex-col border border-border rounded-lg bg-bg-card shadow-card transition-all ${
        open ? "w-full lg:w-80 shrink-0" : "w-12"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-3 py-2 border-b border-border font-mono text-[11px] text-accent uppercase tracking-wider"
      >
        {open ? "AI table filter" : "AI"}
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="flex flex-col flex-1 p-3 gap-3 min-h-0 overflow-hidden">
          <p className="text-[10px] text-text-faint leading-snug">
            Filters the main table using semantic search on profiles. Optional
            matcher narrows by skill ratings (e.g. React.js:4, Node.js:4).
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void ask();
              }
            }}
            placeholder="Who is on bench in May? Who is allocated to CIS in June? Best MERN dev at 4+?"
            rows={3}
            className="w-full rounded border border-border bg-bg-elev px-2 py-2 text-sm text-text resize-none outline-none focus:border-accent focus:ring-1 focus:ring-accent/25"
          />
          <textarea
            value={matcherInput}
            onChange={(e) => setMatcherInput(e.target.value)}
            placeholder="Optional matcher: React.js:4, Node.js:4, MongoDB:3"
            rows={2}
            className="w-full rounded border border-border bg-bg-elev px-2 py-1.5 font-mono text-[10px] text-text resize-none outline-none focus:border-accent focus:ring-1 focus:ring-accent/25"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={ask}
              disabled={loading}
              className="flex-1 rounded bg-accent/20 border border-accent/50 py-1.5 text-sm text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {loading ? "Searching…" : "Filter table"}
            </button>
            <button
              type="button"
              onClick={reindex}
              disabled={loading}
              title="Rebuild embeddings for all profiles"
              className="rounded border border-border px-2 py-1.5 text-[10px] text-text-dim hover:border-accent"
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
              className="text-xs text-accent hover:underline text-left"
            >
              Clear AI filter ({activeFilterCount})
            </button>
          )}

          {error && <p className="text-bad text-xs">{error}</p>}
          {status && (
            <p className="text-xs text-text-dim leading-relaxed">{status}</p>
          )}
        </div>
      )}
    </aside>
  );
}
