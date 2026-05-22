"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddPersonModal } from "./AddPersonModal";
import { AddTagModal } from "./AddTagModal";
import { BulkEditFlagModal } from "./BulkEditFlagModal";
import { AiPanel } from "./AiPanel";
import { ConfirmModal } from "./ConfirmModal";
import { AiAssessModal, type AssessScope } from "./AiAssessModal";
import { GenerateProfileModal } from "./GenerateProfileModal";
import { TeamTable } from "./TeamTable";
import { memberMatchesFlagFilter, normalizeSeverity } from "@/lib/aiFlags";
import { matchesSpecFilter } from "@/lib/specializations";
import {
  mergeTags,
  parseTag,
  tagMatchesFilter,
  uniqueCanonicalTags,
} from "@/lib/tags";
import { parseExpNum } from "@/lib/memberService";
import type { TeamMemberClient } from "@/lib/types";

export function TeamDirectory() {
  const [members, setMembers] = useState<TeamMemberClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [aiFilterIds, setAiFilterIds] = useState<Set<string> | null>(null);
  const [aiFilterLabel, setAiFilterLabel] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [tagModalMember, setTagModalMember] = useState<TeamMemberClient | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberClient | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [generateProfileOpen, setGenerateProfileOpen] = useState(false);
  const [flagFilter, setFlagFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessScope, setAssessScope] = useState<AssessScope>("all");
  const [assessTargets, setAssessTargets] = useState<TeamMemberClient[]>([]);
  const [assessSingle, setAssessSingle] = useState<TeamMemberClient | null>(
    null
  );
  const [assessProgress, setAssessProgress] = useState<{
    done: number;
    total: number;
    current?: string;
  } | null>(null);
  const [bulkFlagOpen, setBulkFlagOpen] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setMembers(data.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    const raw: string[] = [];
    members.forEach((m) => m.tags.forEach((t) => t && raw.push(t)));
    return uniqueCanonicalTags(raw);
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter((m) => {
      if (aiFilterIds !== null && !aiFilterIds.has(m.id)) return false;
      if (
        specFilter &&
        !matchesSpecFilter(
          m.specializations?.length ? m.specializations : [m.specialization],
          specFilter
        )
      )
        return false;
      if (!memberMatchesFlagFilter(m.aiFlags, flagFilter)) return false;
      if (
        tagFilter.length &&
        !tagFilter.every((t) => tagMatchesFilter(m.tags, t))
      )
        return false;
      if (!q) return true;
      const blob = [
        m.id,
        m.name,
        m.role,
        m.email,
        m.specialization,
        ...(m.specializations ?? []),
        m.stackLabel,
        ...m.stacks,
        ...m.tags,
        ...m.skills,
        m.notes ?? "",
        m.aiFlags?.summary ?? "",
        ...(m.aiFlags?.reasons ?? []),
        m.aiFlags?.severity ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [members, search, specFilter, tagFilter, flagFilter, aiFilterIds]);

  const flagCounts = useMemo(() => {
    const counts: Record<string, number> = {
      staffing: 0,
      info: 0,
      watch: 0,
      action: 0,
      replacement: 0,
      ok: 0,
      none: 0,
    };
    members.forEach((m) => {
      const f = m.aiFlags;
      if (memberMatchesFlagFilter(f, "staffing")) counts.staffing++;
      const s = normalizeSeverity(f?.severity);
      if (s === "info") counts.info++;
      else if (s === "watch") counts.watch++;
      else if (s === "action") counts.action++;
      else if (s === "replacement") counts.replacement++;
      else if (s === "ok") counts.ok++;
      else if (s === "none" && !f?.flagged) counts.none++;
    });
    return counts;
  }, [members]);

  const specs = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((m) => {
      const list = m.specializations?.length
        ? m.specializations
        : [m.specialization];
      list.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members]);

  const patchMember = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? data.member : m))
    );
    return data.member as TeamMemberClient;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const resolveAssessTargets = (
    scope: AssessScope,
    single?: TeamMemberClient
  ): TeamMemberClient[] => {
    if (scope === "single" && single) return [single];
    if (scope === "all") return [...members];
    if (scope === "filtered") return [...filtered];
    return members.filter((m) => selectedIds.has(m.id));
  };

  const openAssess = (scope: AssessScope, single?: TeamMemberClient) => {
    const targets = resolveAssessTargets(scope, single);
    if (scope === "selected" && targets.length === 0) {
      showToast("Select at least one person in the table first");
      return;
    }
    setAssessScope(scope);
    setAssessSingle(single ?? null);
    setAssessTargets(targets);
    setAssessOpen(true);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      showToast(`Import: ${data.created} new, ${data.updated} updated`);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import error");
    } finally {
      setImporting(false);
    }
  };

  const createMember = async (data: {
    id: string;
    name: string;
    role: string;
    exp: string;
    email: string;
  }) => {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id,
        name: data.name,
        role: data.role,
        exp: data.exp,
        expNum: parseExpNum(data.exp),
        skills: [],
        email: data.email,
        tags: [],
        projects: [],
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Create failed");
    setMembers((prev) => [...prev, json.member]);
    setExpandedId(data.id);
    showToast(`Added ${data.id}`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      setMembers((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      if (expandedId === deleteTarget.id) setExpandedId(null);
      showToast(`Removed ${deleteTarget.name || deleteTarget.id}`);
      setDeleteTarget(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete error");
    } finally {
      setDeleting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const exportFiltered = async (format: "xlsx" | "json") => {
    if (!filtered.length) {
      showToast("No rows to export — adjust filters");
      return;
    }
    const ids = filtered.map((m) => m.id);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, ids }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      if (format === "json") {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `team-export-${ids.length}-rows.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `team-export-${ids.length}-rows.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
      const scope =
        filtered.length === members.length
          ? "all"
          : `${filtered.length} filtered`;
      showToast(`Exported ${scope} row${filtered.length === 1 ? "" : "s"}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b border-border bg-bg-elev/95 backdrop-blur shadow-sm sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-4 py-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] text-text-faint tracking-widest uppercase mb-1">
              Techverx · Internal
            </p>
            <h1 className="font-display text-3xl md:text-4xl">
              Team <em className="text-accent not-italic">Directory</em>
            </h1>
            <p className="text-text-dim text-sm mt-1 max-w-xl">
              Table-first skills database · MongoDB · AI staffing assistant
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="font-mono text-[10px] text-text-faint uppercase tracking-wider w-full text-right">
              Actions
            </p>
          <div className="flex flex-wrap gap-2 items-center justify-end font-mono text-xs">
            <span className="text-text-dim" title="Rows shown after all filters">
              {filtered.length}/{members.length}
            </span>
            <label className="cursor-pointer rounded border border-border px-3 py-1.5 hover:border-accent">
              {importing ? "Importing…" : "Import Excel"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              disabled={!filtered.length}
              onClick={() => exportFiltered("xlsx")}
              title={
                filtered.length === members.length
                  ? "Export all rows in the table"
                  : `Export ${filtered.length} filtered row${filtered.length === 1 ? "" : "s"}`
              }
              className="rounded border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
            >
              Export Excel
              {filtered.length > 0 &&
                filtered.length < members.length &&
                ` (${filtered.length})`}
            </button>
            <button
              type="button"
              disabled={!filtered.length}
              onClick={() => exportFiltered("json")}
              title={
                filtered.length === members.length
                  ? "Export all rows as JSON"
                  : `Export ${filtered.length} filtered row${filtered.length === 1 ? "" : "s"} as JSON`
              }
              className="rounded border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
            >
              Export JSON
              {filtered.length > 0 &&
                filtered.length < members.length &&
                ` (${filtered.length})`}
            </button>
            <button
              type="button"
              disabled={loading || !!assessProgress}
              onClick={() => openAssess("all")}
              className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              AI Assess all
            </button>
            <button
              type="button"
              disabled={loading || !!assessProgress || filtered.length === members.length}
              onClick={() => openAssess("filtered")}
              className="rounded border border-border px-3 py-1.5 hover:border-accent disabled:opacity-50"
              title="Assess everyone matching current filters"
            >
              Assess filtered
            </button>
            <button
              type="button"
              disabled={loading || !!assessProgress || selectedIds.size === 0}
              onClick={() => openAssess("selected")}
              className="rounded border border-border px-3 py-1.5 hover:border-accent disabled:opacity-50"
            >
              Assess selected ({selectedIds.size})
            </button>
            <button
              type="button"
              disabled={loading || selectedIds.size === 0}
              onClick={() => setBulkFlagOpen(true)}
              title="Apply the same flag severity, summary, and reasons to all selected rows"
              className="rounded border border-border px-3 py-1.5 hover:border-accent disabled:opacity-50"
            >
              Set flag ({selectedIds.size})
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="rounded border border-border px-3 py-1.5 text-text-dim hover:border-accent text-xs"
              >
                Clear selection ({selectedIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={() => setGenerateProfileOpen(true)}
              className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 text-accent"
            >
              AI Profile
            </button>
            <button
              type="button"
              onClick={() => setAddPersonOpen(true)}
              className="rounded border border-border px-3 py-1.5 hover:border-accent"
            >
              + Person
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-border px-3 py-1.5"
            >
              Refresh
            </button>
          </div>
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 pt-1 pb-1">
          <p className="font-mono text-[10px] text-text-faint uppercase tracking-wider">
            Filters
          </p>
        </div>
        <div className="max-w-[1800px] mx-auto px-4 pb-3 flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, skills, tags, allocations…"
            className="flex-1 min-w-[200px] rounded border border-border bg-bg-elev px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
          <select
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            className="rounded border border-border bg-bg-elev px-2 py-2 text-sm"
          >
            <option value="">All specializations</option>
            {specs.map(([s, n]) => (
              <option key={s} value={s}>
                {s} ({n})
              </option>
            ))}
          </select>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            title="Filter table by staffing flag severity"
            className="rounded border border-border bg-bg-elev px-2 py-2 text-sm min-w-[140px]"
          >
            <option value="">All flags</option>
            <option value="staffing">
              Any staffing flag ({flagCounts.staffing})
            </option>
            <option value="info">Info ({flagCounts.info})</option>
            <option value="watch">Watch ({flagCounts.watch})</option>
            <option value="action">Action ({flagCounts.action})</option>
            <option value="replacement">
              Replacement ({flagCounts.replacement})
            </option>
            <option value="ok">OK / reviewed ({flagCounts.ok})</option>
            <option value="none">No flag ({flagCounts.none})</option>
          </select>
          {aiFilterIds !== null && (
            <span className="font-mono text-[10px] rounded-full border border-accent/50 bg-accent/10 text-accent px-2 py-1">
              AI: {aiFilterLabel || `${aiFilterIds.size} shown`}
            </span>
          )}
          {(search ||
            specFilter ||
            tagFilter.length > 0 ||
            flagFilter ||
            aiFilterIds !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSpecFilter("");
                setTagFilter([]);
                setFlagFilter("");
                setAiFilterIds(null);
                setAiFilterLabel("");
              }}
              className="text-text-dim text-xs hover:text-accent"
            >
              Reset filters
            </button>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="max-w-[1800px] mx-auto px-4 pb-1">
            <p className="font-mono text-[10px] text-text-faint uppercase tracking-wider">
              Tag filters <span className="normal-case text-text-dim">(click to toggle, AND together)</span>
            </p>
          </div>
        )}
        {allTags.length > 0 && (
          <div className="max-w-[1800px] mx-auto px-4 pb-3 flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`font-mono text-[10px] rounded-full px-2 py-0.5 border ${
                  tagFilter.includes(tag)
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-text-dim"
                }`}
              >
                {parseTag(tag).label}
              </button>
            ))}
          </div>
        )}
      </header>

      {(toast || assessProgress) && (
        <div className="fixed bottom-4 right-4 z-50 rounded border border-border bg-bg-card px-4 py-2 text-sm shadow-card-lg text-text max-w-sm">
          {assessProgress && (
            <p className="font-mono text-xs text-text-dim mb-1">
              AI assessing {assessProgress.done}/{assessProgress.total}
              {assessProgress.current ? ` · ${assessProgress.current}` : ""}
            </p>
          )}
          {toast && <p>{toast}</p>}
        </div>
      )}

      <div className="flex-1 flex min-h-0 max-w-[1800px] mx-auto w-full px-4 py-4 gap-4">
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {error && (
            <div className="rounded border border-bad/40 bg-red-50 p-4 mb-4 text-sm">
              <p className="text-bad font-medium">{error}</p>
              <p className="text-text-dim mt-2 text-xs">
                Ensure MongoDB is running at your MONGODB_URI. Start with:{" "}
                <code className="text-accent">brew services start mongodb-community</code>{" "}
                or use MongoDB Atlas.
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-text-dim font-mono text-sm">Loading team…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-text-dim text-sm rounded-lg border border-border">
              {aiFilterIds !== null
                ? "No one matches your AI search. Try a broader question, clear the AI filter, or run Reindex in the AI panel."
                : (
                  <>
                    No members match filters. Import Excel or run{" "}
                    <code className="text-accent">npm run seed</code>.
                  </>
                )}
            </p>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
            <TeamTable
              members={filtered}
              expandedId={expandedId}
              onExpand={setExpandedId}
              onPatch={patchMember}
              onDelete={setDeleteTarget}
              onAddTag={setTagModalMember}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAllVisible={(checked) => {
                if (checked) {
                  setSelectedIds(new Set(filtered.map((m) => m.id)));
                } else {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    filtered.forEach((m) => next.delete(m.id));
                    return next;
                  });
                }
              }}
              onAssess={(m) => openAssess("single", m)}
              onMemberUpdate={(member) =>
                setMembers((prev) =>
                  prev.map((m) => (m.id === member.id ? member : m))
                )
              }
              onToast={showToast}
            />
            </div>
          )}
        </main>

        <AiPanel
          activeFilterCount={aiFilterIds?.size ?? 0}
          aiFilterActive={aiFilterIds !== null}
          onApplyFilter={(ids, summary) => {
            setAiFilterIds(new Set(ids));
            setAiFilterLabel(summary);
            if (ids.length) {
              setToast(summary);
              setTimeout(() => setToast(""), 4000);
            }
          }}
          onClearFilter={() => {
            setAiFilterIds(null);
            setAiFilterLabel("");
          }}
        />
      </div>

      <GenerateProfileModal
        open={generateProfileOpen}
        onClose={() => setGenerateProfileOpen(false)}
        onSaved={(member) => {
          setMembers((prev) => {
            const i = prev.findIndex((m) => m.id === member.id);
            if (i >= 0) {
              const next = [...prev];
              next[i] = member;
              return next;
            }
            return [...prev, member];
          });
          setExpandedId(member.id);
          showToast(`Profile saved for ${member.id}`);
        }}
      />

      <AddPersonModal
        open={addPersonOpen}
        onClose={() => setAddPersonOpen(false)}
        onSubmit={createMember}
      />

      <BulkEditFlagModal
        open={bulkFlagOpen}
        onClose={() => setBulkFlagOpen(false)}
        count={selectedMembers.length}
        previewNames={selectedMembers.map((m) => m.name || m.id).slice(0, 8)}
        onSave={async (aiFlags) => {
          const ids = selectedMembers.map((m) => m.id);
          let failed = 0;
          for (let i = 0; i < ids.length; i++) {
            try {
              await patchMember(ids[i], { aiFlags });
            } catch {
              failed++;
            }
          }
          setBulkFlagOpen(false);
          const ok = ids.length - failed;
          if (failed) {
            showToast(`Flag updated on ${ok}, ${failed} failed`);
          } else {
            showToast(`Flag updated on ${ok} ${ok === 1 ? "person" : "people"}`);
          }
        }}
      />

      <AddTagModal
        open={tagModalMember != null}
        onClose={() => setTagModalMember(null)}
        memberName={tagModalMember?.name ?? ""}
        existingTags={tagModalMember?.tags ?? []}
        onSubmit={async (newTags) => {
          if (!tagModalMember) return;
          const tags = mergeTags(tagModalMember.tags, newTags);
          await patchMember(tagModalMember.id, { tags });
          setTagModalMember(null);
        }}
      />

      <AiAssessModal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        scope={assessScope}
        members={assessTargets}
        singleMember={assessSingle}
        onProgress={(done, total, current) =>
          setAssessProgress({ done, total, current })
        }
        onMemberAssessed={(member) =>
          setMembers((prev) =>
            prev.map((m) => (m.id === member.id ? member : m))
          )
        }
        onComplete={async ({ ok, skipped, failed }) => {
          setAssessOpen(false);
          setAssessProgress(null);
          const parts = [`Assessed ${ok}`];
          if (skipped) parts.push(`${skipped} skipped`);
          if (failed) parts.push(`${failed} failed`);
          showToast(parts.join(", "));
          if (assessScope === "all") {
            await load({ silent: true });
          }
        }}
      />

      <ConfirmModal
        open={deleteTarget != null}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete team member"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.name || deleteTarget.id} (${deleteTarget.id}) from the database? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
