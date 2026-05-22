"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BulkRatingModal } from "./BulkRatingModal";
import { SkillEditor } from "./SkillEditor";
import { SpecBadges } from "./SpecBadges";
import { EditSpecsModal } from "./EditSpecsModal";
import { TagsList } from "./TagChip";
import { Tooltip } from "./Tooltip";
import { FlagBadge } from "./FlagBadge";
import { WorkflowEntriesModal } from "./WorkflowEntriesModal";
import type { TeamMemberClient } from "@/lib/types";

const STORAGE_KEY = "techverx-table-columns-v3";

type ColKey =
  | "select"
  | "id"
  | "name"
  | "flag"
  | "role"
  | "exp"
  | "spec"
  | "stack"
  | "tags"
  | "skills"
  | "email"
  | "nextSteps"
  | "escalation"
  | "actions";

const COLS: { key: ColKey; label: string; min: number; default: number }[] = [
  { key: "select", label: "", min: 32, default: 36 },
  { key: "id", label: "ID", min: 72, default: 96 },
  { key: "name", label: "Name", min: 100, default: 130 },
  { key: "flag", label: "Flag", min: 52, default: 64 },
  { key: "role", label: "Role", min: 120, default: 160 },
  { key: "exp", label: "Exp", min: 48, default: 56 },
  { key: "spec", label: "Spec", min: 100, default: 120 },
  { key: "stack", label: "Stack", min: 80, default: 120 },
  { key: "tags", label: "Tags", min: 100, default: 120 },
  { key: "skills", label: "Skills", min: 72, default: 88 },
  { key: "email", label: "Email", min: 120, default: 160 },
  { key: "nextSteps", label: "Next steps", min: 88, default: 108 },
  { key: "escalation", label: "Escalation", min: 88, default: 108 },
  { key: "actions", label: "", min: 56, default: 64 },
];

const DEFAULT_WIDTHS = Object.fromEntries(
  COLS.map((c) => [c.key, c.default])
) as Record<ColKey, number>;

/** Left columns that stay visible when scrolling horizontally */
const FROZEN_COLS: ColKey[] = ["select", "id", "name"];

function isFrozenCol(key: ColKey): boolean {
  return FROZEN_COLS.includes(key);
}

type FrozenRowTone = "default" | "watch" | "action";

function frozenRowTone(member: TeamMemberClient): FrozenRowTone {
  if (member.aiFlags?.flagged && member.aiFlags.severity === "action") {
    return "action";
  }
  if (member.aiFlags?.flagged) return "watch";
  return "default";
}

/** Opaque backgrounds only — frozen cells must not use /50 or tr opacity. */
function frozenCellClasses(
  key: ColKey,
  opts: {
    header?: boolean;
    lastFrozen?: boolean;
    tone?: FrozenRowTone;
  }
): string {
  if (!isFrozenCol(key)) return "";
  const shadow = opts.lastFrozen
    ? "shadow-[4px_0_6px_-2px_rgba(15,23,42,0.08)] border-r border-border-soft"
    : "";
  if (opts.header) {
    return `frozen-cell frozen-cell-header bg-white ${shadow}`;
  }
  const tone = opts.tone ?? "default";
  const bg =
    tone === "action"
      ? "frozen-cell frozen-cell-action"
      : tone === "watch"
        ? "frozen-cell frozen-cell-watch"
        : "frozen-cell frozen-cell-default";
  return `${bg} ${shadow}`;
}

function loadWidths(): Record<ColKey, number> {
  if (typeof window === "undefined") return DEFAULT_WIDTHS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTHS;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out = { ...DEFAULT_WIDTHS };
    for (const col of COLS) {
      if (typeof parsed[col.key] === "number" && parsed[col.key] >= col.min) {
        out[col.key] = parsed[col.key];
      }
    }
    return out;
  } catch {
    return DEFAULT_WIDTHS;
  }
}

function EditableCell({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        autoFocus
        className={`w-full bg-bg-elev border border-accent/40 rounded px-1 py-0.5 font-mono text-xs outline-none ${className}`}
      />
    );
  }

  return (
    <Tooltip content={value}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`w-full text-left truncate font-mono text-xs hover:text-accent ${className}`}
      >
        {value || <span className="text-text-faint italic">—</span>}
      </button>
    </Tooltip>
  );
}

function ResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onResize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize column"
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      className="absolute right-0 top-0 bottom-0 w-2 -mr-1 cursor-col-resize z-10 group"
    >
      <div className="absolute right-1 top-1 bottom-1 w-px bg-border group-hover:bg-accent/70 transition-colors" />
    </div>
  );
}

function WorkflowCellButton({
  label,
  count,
  preview,
  onClick,
}: {
  label: string;
  count: number;
  preview?: string;
  onClick: () => void;
}) {
  const tip = preview?.trim()
    ? preview.trim().slice(0, 200) + (preview.length > 200 ? "…" : "")
    : `Open ${label.toLowerCase()}`;

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded border border-border bg-bg-elev/80 px-2 py-1 font-mono text-[10px] text-text-dim hover:border-accent/50 hover:text-accent text-left truncate"
      >
        {label}
        {count > 0 ? ` (${count})` : ""}
      </button>
    </Tooltip>
  );
}

export function TeamTable({
  members,
  expandedId,
  onExpand,
  onPatch,
  onDelete,
  onAddTag,
  selectedIds,
  onToggleSelect,
  onSelectAllVisible,
  onAssess,
  onMemberUpdate,
  onToast,
}: {
  members: TeamMemberClient[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
  onDelete: (m: TeamMemberClient) => void;
  onAddTag: (m: TeamMemberClient) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: (checked: boolean) => void;
  onAssess: (m: TeamMemberClient) => void;
  onMemberUpdate: (member: TeamMemberClient) => void;
  onToast?: (msg: string) => void;
}) {
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS);
  const [ready, setReady] = useState(false);
  const [bulkMember, setBulkMember] = useState<TeamMemberClient | null>(null);
  const [specsMember, setSpecsMember] = useState<TeamMemberClient | null>(null);
  const [nextStepsMember, setNextStepsMember] =
    useState<TeamMemberClient | null>(null);
  const [escalationsMember, setEscalationsMember] =
    useState<TeamMemberClient | null>(null);

  useEffect(() => {
    setWidths(loadWidths());
    setReady(true);
  }, []);

  const persistWidths = useCallback((next: Record<ColKey, number>) => {
    setWidths(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const resizeCol = useCallback(
    (key: ColKey, delta: number) => {
      const col = COLS.find((c) => c.key === key)!;
      setWidths((prev) => {
        const next = {
          ...prev,
          [key]: Math.max(col.min, prev[key] + delta),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  const resetColumns = () => persistWidths(DEFAULT_WIDTHS);

  const tableMinWidth = COLS.reduce((sum, c) => sum + widths[c.key], 0);

  const frozenLeft = useMemo(() => {
    const map = {} as Partial<Record<ColKey, number>>;
    let acc = 0;
    for (const c of COLS) {
      if (!isFrozenCol(c.key)) continue;
      map[c.key] = acc;
      acc += widths[c.key];
    }
    return map;
  }, [widths]);

  const lastFrozenCol = FROZEN_COLS[FROZEN_COLS.length - 1];

  const stickyFrozenStyle = (key: ColKey): CSSProperties | undefined => {
    if (!isFrozenCol(key)) return undefined;
    return { left: frozenLeft[key] ?? 0 };
  };
  const allVisibleSelected =
    members.length > 0 && members.every((m) => selectedIds.has(m.id));
  const someVisibleSelected = members.some((m) => selectedIds.has(m.id));

  if (!ready) {
    return (
      <p className="text-text-dim font-mono text-sm p-4">Preparing table…</p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card overflow-hidden flex flex-col flex-1 min-h-0 max-h-full shadow-card">
      <div className="shrink-0 flex items-center justify-between px-2 py-1 border-b border-border bg-bg-elev/50">
        <span className="font-mono text-[10px] text-text-faint">
          ID & name stay fixed when scrolling · drag column edges to resize
        </span>
        <button
          type="button"
          onClick={resetColumns}
          className="font-mono text-[10px] text-text-dim hover:text-accent px-2 py-0.5"
        >
          Reset columns
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="team-table w-full text-left border-separate border-spacing-0"
          style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}
        >
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-bg-elev font-mono text-[10px] uppercase tracking-wider text-text-faint">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  style={stickyFrozenStyle(col.key)}
                  className={`sticky top-0 px-2 py-2 text-left select-none border-b border-border ${
                    isFrozenCol(col.key) ? "z-40" : "z-20 bg-bg-elev"
                  } ${frozenCellClasses(col.key, {
                    header: true,
                    lastFrozen: col.key === lastFrozenCol,
                  })}`}
                >
                  {col.key === "select" ? (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            someVisibleSelected && !allVisibleSelected;
                        }
                      }}
                      onChange={(e) => onSelectAllVisible(e.target.checked)}
                      title="Select all rows currently visible in the table"
                      className="accent-accent"
                    />
                  ) : (
                    col.label
                  )}
                  {col.key !== "actions" && col.key !== "select" && (
                    <ResizeHandle
                      onResize={(d) => resizeCol(col.key, d)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const skillsPreview =
                m.skills.length > 0
                  ? m.skills.slice(0, 20).join(", ") +
                    (m.skills.length > 20
                      ? ` … +${m.skills.length - 20} more`
                      : "")
                  : "No skills";

              const frozenTone = frozenRowTone(m);
              const pending = m.specialization === "Profile Pending";
              const dim = pending ? " opacity-60" : "";

              return (
                <Fragment key={m.id}>
                  <tr
                    className={`group border-b border-border-soft hover:bg-bg-card-hover ${
                      m.aiFlags?.flagged && m.aiFlags.severity === "action"
                        ? "bg-red-50/50"
                        : m.aiFlags?.flagged
                          ? "bg-amber-50/40"
                          : ""
                    }`}
                  >
                    <td
                      style={stickyFrozenStyle("select")}
                      className={`sticky z-10 px-2 py-1 text-center ${frozenCellClasses("select", { tone: frozenTone })}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => onToggleSelect(m.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td
                      style={stickyFrozenStyle("id")}
                      className={`sticky z-10 px-2 py-1.5 font-mono text-[11px] text-text-dim max-w-0 ${frozenCellClasses("id", { tone: frozenTone })}`}
                    >
                      <Tooltip content={m.id}>
                        <span>{m.id}</span>
                      </Tooltip>
                    </td>
                    <td
                      style={stickyFrozenStyle("name")}
                      className={`sticky z-10 px-2 py-1 max-w-0 ${frozenCellClasses("name", {
                        tone: frozenTone,
                        lastFrozen: true,
                      })}`}
                    >
                      <EditableCell
                        value={m.name}
                        onSave={(name) => onPatch(m.id, { name })}
                        className="font-medium text-text"
                      />
                    </td>
                    <td className={`px-2 py-1 text-center max-w-0${dim}`}>
                      <FlagBadge flag={m.aiFlags} />
                    </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <EditableCell
                        value={m.role}
                        onSave={(role) => onPatch(m.id, { role })}
                      />
                    </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <EditableCell
                        value={m.exp}
                        onSave={(exp) => onPatch(m.id, { exp })}
                      />
                    </td>
                        <td className={`px-2 py-1 max-w-0${dim}`}>
                          <div className="flex h-[18px] items-center gap-1 min-w-0 flex-nowrap">
                            <SpecBadges
                              nowrap
                              className="min-w-0 overflow-hidden"
                              specializations={
                                m.specializations?.length
                                  ? m.specializations
                                  : [m.specialization]
                              }
                            />
                            <button
                              type="button"
                              title="Edit specializations"
                              onClick={() => setSpecsMember(m)}
                              className="inline-flex h-[18px] shrink-0 items-center text-[9px] leading-none text-text-faint hover:text-accent"
                            >
                              edit
                            </button>
                          </div>
                        </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <EditableCell
                        value={m.stackLabel}
                        onSave={(stackLabel) =>
                          onPatch(m.id, { stackLabel })
                        }
                      />
                    </td>
                        <td className={`px-2 py-1 max-w-0${dim}`}>
                          <div className="flex h-[18px] items-center gap-1 min-w-0 flex-nowrap">
                            {m.tags.length > 0 ? (
                              <TagsList
                                tags={m.tags}
                                limit={1}
                                nowrap
                                className="min-w-0 overflow-hidden"
                                onRemove={async (tag) => {
                                  const tags = m.tags.filter((t) => t !== tag);
                                  await onPatch(m.id, { tags });
                                  onToast?.(`Removed tag`);
                                }}
                              />
                            ) : (
                              <span className="inline-flex h-[18px] shrink-0 items-center text-[10px] leading-none text-text-faint">
                                —
                              </span>
                            )}
                            <button
                              type="button"
                              title="Add tag"
                              onClick={() => onAddTag(m)}
                              className="inline-flex h-[18px] shrink-0 items-center text-[9px] leading-none text-text-faint hover:text-accent"
                            >
                              +
                            </button>
                          </div>
                        </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <div className="flex items-center gap-1 min-w-0">
                        <Tooltip content={skillsPreview} force>
                          <button
                            type="button"
                            onClick={() =>
                              onExpand(expandedId === m.id ? null : m.id)
                            }
                            className="font-mono text-[10px] text-text-dim hover:text-accent text-left truncate flex-1 min-w-0"
                          >
                            {m.skills.length} skills
                            {expandedId === m.id ? " ▲" : " ▼"}
                          </button>
                        </Tooltip>
                        {m.skills.length > 0 && (
                          <button
                            type="button"
                            title="Rate all skills"
                            onClick={() => {
                              onExpand(m.id);
                              setBulkMember(m);
                            }}
                            className="shrink-0 font-mono text-[9px] text-accent hover:underline"
                          >
                            rate
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <EditableCell
                        value={m.email}
                        onSave={(email) => onPatch(m.id, { email })}
                      />
                    </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <WorkflowCellButton
                        label="Steps"
                        count={m.nextStepsLog?.length ?? 0}
                        preview={m.nextSteps}
                        onClick={() => setNextStepsMember(m)}
                      />
                    </td>
                    <td className={`px-2 py-1 max-w-0${dim}`}>
                      <WorkflowCellButton
                        label="Escalate"
                        count={m.escalations?.length ?? 0}
                        preview={
                          m.escalations?.length
                            ? m.escalations[m.escalations.length - 1]?.text
                            : undefined
                        }
                        onClick={() => setEscalationsMember(m)}
                      />
                    </td>
                    <td className={`px-2 py-1 text-center whitespace-nowrap${dim}`}>
                      <button
                        type="button"
                        onClick={() => onAssess(m)}
                        className="font-mono text-[9px] text-accent hover:underline mr-1"
                      >
                        Assess
                      </button>
                      <Tooltip content={`Delete ${m.name || m.id}`}>
                        <button
                          type="button"
                          onClick={() => onDelete(m)}
                          className="text-bad text-xs opacity-50 hover:opacity-100"
                        >
                          ×
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="bg-bg-card">
                      <td colSpan={COLS.length} className="px-4 py-3">
                        <SkillEditor
                          member={m}
                          onUpdate={(patch) => onPatch(m.id, patch)}
                          onRateAll={() => setBulkMember(m)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {specsMember && (
        <EditSpecsModal
          open={specsMember != null}
          onClose={() => setSpecsMember(null)}
          memberName={specsMember.name}
          memberId={specsMember.id}
          specializations={
            specsMember.specializations?.length
              ? specsMember.specializations
              : [specsMember.specialization]
          }
          onSave={async (specializations) => {
            await onPatch(specsMember.id, { specializations });
            setSpecsMember(null);
          }}
        />
      )}

      {bulkMember && (
        <BulkRatingModal
          open={bulkMember != null}
          onClose={() => setBulkMember(null)}
          member={bulkMember}
          onSave={async (bulkSkillRatings) => {
            await onPatch(bulkMember.id, { bulkSkillRatings });
            setBulkMember(null);
          }}
        />
      )}

      {(() => {
        const live =
          nextStepsMember &&
          (members.find((m) => m.id === nextStepsMember.id) ?? nextStepsMember);
        if (!live) return null;
        return (
          <WorkflowEntriesModal
            open={nextStepsMember != null}
            onClose={() => setNextStepsMember(null)}
            title="Next steps"
            description="Track planned follow-ups for this person"
            memberLabel={live.name || live.id}
            entries={live.nextStepsLog ?? []}
            addPlaceholder="What should happen next?"
            onAdd={async (text) => {
              const updated = (await onPatch(live.id, {
                addNextStep: { text },
              })) as TeamMemberClient | undefined;
              if (updated) setNextStepsMember(updated);
            }}
            onDelete={async (entryId) => {
              const updated = (await onPatch(live.id, {
                removeNextStep: entryId,
              })) as TeamMemberClient | undefined;
              if (updated) setNextStepsMember(updated);
            }}
          />
        );
      })()}

      {(() => {
        const live =
          escalationsMember &&
          (members.find((m) => m.id === escalationsMember.id) ??
            escalationsMember);
        if (!live) return null;
        return (
          <WorkflowEntriesModal
            open={escalationsMember != null}
            onClose={() => setEscalationsMember(null)}
            title="Escalations"
            description="Log issues for this person (use AI Assess to update ratings, flags, specs)"
            memberLabel={live.name || live.id}
            entries={live.escalations ?? []}
            addPlaceholder="Describe the escalation or concern…"
            onAdd={async (text) => {
              const updated = (await onPatch(live.id, {
                addEscalation: { text },
              })) as TeamMemberClient | undefined;
              if (updated) setEscalationsMember(updated);
            }}
            onDelete={async (entryId) => {
              const updated = (await onPatch(live.id, {
                removeEscalation: entryId,
              })) as TeamMemberClient | undefined;
              if (updated) setEscalationsMember(updated);
            }}
          />
        );
      })()}
    </div>
  );
}
