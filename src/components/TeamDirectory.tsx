"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddPersonModal } from "./AddPersonModal";
import { AddTagModal } from "./AddTagModal";
import { BulkEditFlagModal } from "./BulkEditFlagModal";
import { AiPanel } from "./AiPanel";
import {
  buildSearchIndexMap,
  memberMatchesQueryExpression,
  QUERY_SEARCH_HINT,
  QUERY_SEARCH_PLACEHOLDER,
} from "@/lib/querySearch";
import { ConfirmModal } from "./ConfirmModal";
import { AiAssessModal, type AssessScope } from "./AiAssessModal";
import { GenerateProfileModal } from "./GenerateProfileModal";
import { TeamTable } from "./TeamTable";
import {
  memberMatchesProbationFilter,
  memberMatchesProfileFilter,
} from "@/lib/profileFilters";
import { normalizeSeverity, memberMatchesFlagFilter } from "@/lib/aiFlags";
import { hasActiveProbation } from "@/lib/probation";
import { matchesSpecFilter } from "@/lib/specializations";
import {
  mergeTags,
  parseTag,
  tagMatchesFilter,
  uniqueCanonicalTags,
} from "@/lib/tags";
import { parseExpNum } from "@/lib/memberService";
import { Field, Input, Select } from "@/components/Field";
import { ToolbarButton, ToolbarLabel } from "@/components/ToolbarButton";
import { uiBtn } from "@/lib/ui";
import type { TeamMemberClient } from "@/lib/types";

function ToolbarSep() {
  return <div className="ui-toolbar-sep" aria-hidden />;
}

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
  const [probationFilter, setProbationFilter] = useState("");
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
  const [tagsOpen, setTagsOpen] = useState(false);

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

  const searchIndex = useMemo(
    () => buildSearchIndexMap(members),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.trim();
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
      if (!memberMatchesProfileFilter(m.aiFlags, flagFilter))
        return false;
      if (!memberMatchesProbationFilter(m.probation, probationFilter))
        return false;
      if (
        tagFilter.length &&
        !tagFilter.every((t) => tagMatchesFilter(m.tags, t))
      )
        return false;
      if (q) {
        const index = searchIndex.get(m.id);
        if (!index || !memberMatchesQueryExpression(index, q)) return false;
      }
      return true;
    });
  }, [
    members,
    search,
    specFilter,
    tagFilter,
    flagFilter,
    probationFilter,
    aiFilterIds,
    searchIndex,
  ]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        search.trim() ||
          specFilter ||
          tagFilter.length > 0 ||
          flagFilter ||
          probationFilter ||
          aiFilterIds !== null
      ),
    [
      search,
      specFilter,
      tagFilter,
      flagFilter,
      probationFilter,
      aiFilterIds,
    ]
  );

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`search "${search.trim()}"`);
    if (specFilter) parts.push(`spec ${specFilter}`);
    if (flagFilter) parts.push(`staffing flag ${flagFilter}`);
    if (probationFilter) {
      parts.push(
        probationFilter === "active" ? "on probation" : "not on probation"
      );
    }
    if (tagFilter.length) parts.push(`tags ${tagFilter.join(" + ")}`);
    if (aiFilterIds !== null) {
      parts.push(aiFilterLabel || `AI filter (${aiFilterIds.size})`);
    }
    return parts.join("; ");
  }, [
    search,
    specFilter,
    flagFilter,
    probationFilter,
    tagFilter,
    aiFilterIds,
    aiFilterLabel,
  ]);

  /** Rows visible in the table (respects all active filters). */
  const exportRows = useMemo(() => {
    if (selectedIds.size > 0) {
      return filtered.filter((m) => selectedIds.has(m.id));
    }
    return filtered;
  }, [filtered, selectedIds]);

  const flagCounts = useMemo(() => {
    const counts: Record<string, number> = {
      staffing: 0,
      probation: 0,
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
      if (hasActiveProbation(m.probation)) counts.probation++;
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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
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
    if (!exportRows.length) {
      showToast(
        selectedIds.size > 0
          ? "No selected rows to export"
          : "No rows to export — adjust filters"
      );
      return;
    }
    const ids = exportRows.map((m) => m.id);
    const filteredOnly = hasActiveFilters || selectedIds.size > 0;
    const scopeLabel =
      selectedIds.size > 0
        ? `${ids.length} selected`
        : hasActiveFilters
          ? `${ids.length} filtered`
          : ids.length === members.length
            ? "all"
            : `${ids.length}`;
    const fileStem =
      selectedIds.size > 0
        ? `team-export-selected-${ids.length}`
        : hasActiveFilters
          ? `team-export-filtered-${ids.length}`
          : `team-export-${ids.length}`;
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          ids,
          filteredOnly,
          filterSummary: filterSummary || undefined,
        }),
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
        a.download = `${fileStem}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileStem}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Exported ${scopeLabel} row${ids.length === 1 ? "" : "s"}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="ui-header">
        <div className="ui-header-top">
          <div className="ui-header-title">
            <h1 className="text-xl md:text-2xl font-bold text-text leading-tight">
              Team Directory
            </h1>
            <p className="text-text-dim text-sm mt-0.5">
              {filtered.length} of {members.length} people
            </p>
          </div>
        </div>

        <div className="ui-toolbar-row">
          <div className="ui-toolbar">
            <ToolbarLabel tone="import">
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
            </ToolbarLabel>
            <ToolbarButton
              tone="exportExcel"
              disabled={!exportRows.length}
              onClick={() => exportFiltered("xlsx")}
              title={
                selectedIds.size > 0
                  ? `Export ${exportRows.length} selected row${exportRows.length === 1 ? "" : "s"}`
                  : hasActiveFilters
                    ? `Export ${exportRows.length} filtered row${exportRows.length === 1 ? "" : "s"} (${members.length} total)`
                    : `Export all ${exportRows.length} rows`
              }
            >
              Export Excel
            </ToolbarButton>
            <ToolbarButton
              tone="exportJson"
              disabled={!exportRows.length}
              onClick={() => exportFiltered("json")}
              title={
                selectedIds.size > 0
                  ? `Export ${exportRows.length} selected rows as JSON`
                  : hasActiveFilters
                    ? `Export ${exportRows.length} filtered rows as JSON`
                    : `Export all rows as JSON`
              }
            >
              Export JSON
            </ToolbarButton>

            <ToolbarSep />

            <ToolbarButton
              tone="assessAll"
              disabled={loading || !!assessProgress}
              onClick={() => openAssess("all")}
            >
              AI Assess all
            </ToolbarButton>
            <ToolbarButton
              tone="assessFiltered"
              disabled={loading || !!assessProgress || filtered.length === members.length}
              onClick={() => openAssess("filtered")}
              title="Assess everyone matching current filters"
            >
              Assess filtered
            </ToolbarButton>
            <ToolbarButton
              tone="assessSelected"
              disabled={loading || !!assessProgress || selectedIds.size === 0}
              onClick={() => openAssess("selected")}
            >
              Assess selected ({selectedIds.size})
            </ToolbarButton>
            <ToolbarButton
              tone="aiProfile"
              onClick={() => setGenerateProfileOpen(true)}
            >
              AI Profile
            </ToolbarButton>

            <ToolbarSep />

            <ToolbarButton
              tone="setFlag"
              disabled={loading || selectedIds.size === 0}
              onClick={() => setBulkFlagOpen(true)}
              title="Apply the same flag severity, summary, and reasons to all selected rows"
            >
              Set flag ({selectedIds.size})
            </ToolbarButton>
            {selectedIds.size > 0 && (
              <ToolbarButton tone="clear" onClick={clearSelection}>
                Clear selection ({selectedIds.size})
              </ToolbarButton>
            )}

            <ToolbarSep />

            <ToolbarButton tone="addPerson" onClick={() => setAddPersonOpen(true)}>
              Add person
            </ToolbarButton>
            <ToolbarButton tone="refresh" onClick={() => void load()}>
              Refresh
            </ToolbarButton>
            <ToolbarButton tone="logout" onClick={() => void handleLogout()}>
              Log out
            </ToolbarButton>
          </div>
        </div>

        <div className="ui-header-filters">
          <Field label="Search" className="ui-header-field ui-header-field-search">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={QUERY_SEARCH_PLACEHOLDER}
              title={QUERY_SEARCH_HINT}
            />
          </Field>
          <Field label="Spec" className="ui-header-field">
            <Select
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value)}
            >
              <option value="">All</option>
              {specs.map(([s, n]) => (
                <option key={s} value={s}>
                  {s} ({n})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Flag" className="ui-header-field">
            <Select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              title="Filter by staffing flag (Info, Watch, Action, etc.)"
            >
            <option value="">All</option>
            <option value="staffing">
              Staffing ({flagCounts.staffing})
            </option>
            <option value="info">Info ({flagCounts.info})</option>
            <option value="watch">Watch ({flagCounts.watch})</option>
            <option value="action">Action ({flagCounts.action})</option>
            <option value="replacement">
              Replace ({flagCounts.replacement})
            </option>
            <option value="ok">OK ({flagCounts.ok})</option>
            <option value="none">None ({flagCounts.none})</option>
            </Select>
          </Field>
          <Field label="Probation" className="ui-header-field">
            <Select
              value={probationFilter}
              onChange={(e) => setProbationFilter(e.target.value)}
              title="Filter by HR probation status"
              className={
                probationFilter
                  ? "border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-500/15"
                  : undefined
              }
            >
            <option value="">All</option>
            <option value="active">
              Active ({flagCounts.probation})
            </option>
            <option value="inactive">
              Clear ({members.length - flagCounts.probation})
            </option>
            </Select>
          </Field>
          {aiFilterIds !== null && (
            <span className="ui-badge-ai shrink-0 self-end mb-0.5">
              AI: {aiFilterLabel || `${aiFilterIds.size} shown`}
            </span>
          )}
          {(search ||
            specFilter ||
            tagFilter.length > 0 ||
            flagFilter ||
            probationFilter ||
            aiFilterIds !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSpecFilter("");
                setTagFilter([]);
                setFlagFilter("");
                setProbationFilter("");
                setAiFilterIds(null);
                setAiFilterLabel("");
              }}
              className={`${uiBtn.ghost} text-xs shrink-0 self-end mb-0.5 h-8`}
            >
              Reset
            </button>
          )}
          {allTags.length > 0 && (
            <button
              type="button"
              onClick={() => setTagsOpen((v) => !v)}
              className={`${uiBtn.ghost} text-xs shrink-0 self-end mb-0.5 h-8`}
            >
              Tags {tagsOpen ? "▲" : "▼"} ({allTags.length})
              {tagFilter.length > 0 ? ` · ${tagFilter.length} on` : ""}
            </button>
          )}
        </div>

        {allTags.length > 0 && tagsOpen && (
          <div className="ui-header-tags">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  tagFilter.includes(tag) ? "ui-chip-active" : "ui-chip-inactive"
                }
              >
                {parseTag(tag).label}
              </button>
            ))}
          </div>
        )}
      </header>

      {(toast || assessProgress) && (
        <div className="ui-toast">
          {assessProgress && (
            <p className="text-xs text-text-dim mb-1 font-medium">
              AI assessing {assessProgress.done}/{assessProgress.total}
              {assessProgress.current ? ` · ${assessProgress.current}` : ""}
            </p>
          )}
          {toast && <p>{toast}</p>}
        </div>
      )}

      <div className="flex-1 flex min-h-0 w-full px-3 py-2 gap-2">
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {error && (
            <div className="ui-alert-error mb-4">
              <p className="text-bad font-semibold">{error}</p>
              <p className="text-text-dim mt-2 text-xs leading-relaxed">
                Ensure MongoDB is running at your MONGODB_URI. Start with:{" "}
                <code className="ui-kbd">brew services start mongodb-community</code>{" "}
                or use MongoDB Atlas.
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-text-dim text-sm">Loading team…</p>
          ) : filtered.length === 0 ? (
            <p className="ui-empty">
              {aiFilterIds !== null
                ? "No one matches your AI search. Try a broader question, clear the AI filter, or run Reindex in the AI panel."
                : (
                  <>
                    No members match filters. Import Excel or run{" "}
                    <code className="ui-kbd">npm run seed</code>.
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
        teamTags={allTags}
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
