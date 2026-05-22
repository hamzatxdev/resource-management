"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSESS_FIELD_OPTIONS,
  defaultAssessFieldConfigs,
  type AssessFieldConfig,
} from "@/lib/assessFields";
import { Modal, ModalButton, ModalField, modalInputClass } from "./Modal";
import type { TeamMemberClient } from "@/lib/types";

export type AssessScope = "all" | "filtered" | "selected" | "single";

export function AiAssessModal({
  open,
  onClose,
  scope,
  members,
  singleMember,
  onProgress,
  onMemberAssessed,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  scope: AssessScope;
  members: TeamMemberClient[];
  singleMember?: TeamMemberClient | null;
  onProgress?: (done: number, total: number, current?: string) => void;
  onMemberAssessed?: (member: TeamMemberClient) => void;
  onComplete: (results: {
    ok: number;
    skipped: number;
    failed: number;
  }) => void;
}) {
  const [fieldConfigs, setFieldConfigs] = useState<AssessFieldConfig[]>(
    defaultAssessFieldConfigs()
  );
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (open) {
      setFieldConfigs(defaultAssessFieldConfigs());
      setStarting(false);
    }
  }, [open]);

  const targets = useMemo(() => {
    if (scope === "single" && singleMember) return [singleMember];
    return members;
  }, [scope, singleMember, members]);

  const scopeLabel =
    scope === "all"
      ? `all ${targets.length} people`
      : scope === "filtered"
        ? `${targets.length} filtered`
        : scope === "selected"
          ? `${targets.length} selected`
          : singleMember?.name || singleMember?.id || "profile";

  const toggleField = (field: AssessFieldConfig["field"]) => {
    setFieldConfigs((prev) =>
      prev.map((c) =>
        c.field === field ? { ...c, enabled: !c.enabled } : c
      )
    );
  };

  const toggleRedo = (field: AssessFieldConfig["field"]) => {
    setFieldConfigs((prev) =>
      prev.map((c) => (c.field === field ? { ...c, redo: !c.redo } : c))
    );
  };

  const run = async () => {
    if (!fieldConfigs.some((c) => c.enabled) || !targets.length || starting) {
      return;
    }

    setStarting(true);
    const configs = fieldConfigs;
    const targetList = [...targets];
    const targetIds = new Set(targetList.map((m) => m.id));

    onClose();
    onProgress?.(0, targetList.length);

    let ok = 0;
    let skipped = 0;
    let failed = 0;
    const concurrency = 3;
    let index = 0;

    const runOne = async (member: TeamMemberClient) => {
      if (!targetIds.has(member.id)) return;
      try {
        const res = await fetch("/api/ai/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: member.id, fields: configs }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Assess failed");
        if (data.skipped) {
          skipped += 1;
        } else {
          ok += 1;
          if (data.member) onMemberAssessed?.(data.member);
        }
        if (data.warnings) {
          console.warn(data.warnings);
        }
      } catch {
        failed += 1;
      } finally {
        const done = ok + skipped + failed;
        onProgress?.(done, targetList.length, member.name || member.id);
      }
    };

    try {
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (true) {
            const i = index;
            index += 1;
            if (i >= targetList.length) break;
            await runOne(targetList[i]);
          }
        })
      );
      onComplete({ ok, skipped, failed });
    } catch {
      onComplete({ ok, skipped, failed: failed + 1 });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="AI assess profiles" size="lg"
      description={`Choose what to update for ${scopeLabel}. Enable Redo to replace existing values.`}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={starting}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            disabled={starting || !fieldConfigs.some((c) => c.enabled)}
            onClick={run}
          >
            {starting
              ? "Starting…"
              : `Assess ${targets.length} profile${targets.length === 1 ? "" : "s"}`}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-text-dim">
          Checked fields are always assessed and saved. Use <strong>Redo</strong>{" "}
          to tell the AI to replace existing values. Progress shows bottom-right
          while the table stays visible.
        </p>
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-elev font-mono text-[10px] uppercase text-text-faint">
                <th className="text-left px-3 py-2">Field</th>
                <th className="text-center px-2 py-2 w-16">Assess</th>
                <th className="text-center px-2 py-2 w-16">Redo</th>
              </tr>
            </thead>
            <tbody>
              {ASSESS_FIELD_OPTIONS.map((opt) => {
                const cfg = fieldConfigs.find((c) => c.field === opt.id)!;
                return (
                  <tr key={opt.id} className="border-t border-border-soft">
                    <td className="px-3 py-2">
                      <p className="font-medium text-text">{opt.label}</p>
                      <p className="text-xs text-text-dim">{opt.description}</p>
                    </td>
                    <td className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={() => toggleField(opt.id)}
                        disabled={starting}
                        className="accent-accent"
                      />
                    </td>
                    <td className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={cfg.redo}
                        onChange={() => toggleRedo(opt.id)}
                        disabled={starting || !cfg.enabled}
                        title="Replace existing values"
                        className="accent-accent"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ModalField label="Scope">
          <p className={`${modalInputClass} bg-bg-card text-text-dim`}>
            {scopeLabel}
          </p>
          {scope === "selected" && targets.length > 0 && (
            <ul className="mt-2 max-h-28 overflow-y-auto font-mono text-[10px] text-text-dim space-y-0.5">
              {targets.slice(0, 12).map((m) => (
                <li key={m.id}>
                  {m.id} · {m.name || "—"}
                </li>
              ))}
              {targets.length > 12 && (
                <li>…and {targets.length - 12} more</li>
              )}
            </ul>
          )}
        </ModalField>
      </div>
    </Modal>
  );
}
