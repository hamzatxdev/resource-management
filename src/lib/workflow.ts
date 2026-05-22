import { randomUUID } from "crypto";
import type { WorkflowEntry } from "./types";

export function normalizeWorkflowEntries(raw: unknown): WorkflowEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const x = e as Record<string, unknown>;
    return {
      id: String(x.id ?? ""),
      text: String(x.text ?? ""),
      createdAt: x.createdAt
        ? new Date(x.createdAt as string).toISOString()
        : new Date().toISOString(),
      assessment: (x.assessment as string) || undefined,
      appliedAt: x.appliedAt
        ? new Date(x.appliedAt as string).toISOString()
        : undefined,
    };
  });
}

export function latestWorkflowText(entries: WorkflowEntry[]): string {
  if (!entries.length) return "";
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0]?.text ?? "";
}

export function newWorkflowEntry(
  text: string,
  opts?: { assessment?: string }
): WorkflowEntry {
  return {
    id: randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    assessment: opts?.assessment,
  };
}

/** Append a workflow entry; returns plain objects safe for Mongoose `.set()`. */
export function appendWorkflowEntry(
  existing: unknown,
  text: string,
  opts?: { assessment?: string }
): WorkflowEntry[] {
  return [
    ...normalizeWorkflowEntries(existing),
    newWorkflowEntry(text, opts),
  ];
}

export function buildNextStepsLog(
  logRaw: unknown,
  legacyNextSteps: string,
  updatedAt?: Date
): WorkflowEntry[] {
  let log = normalizeWorkflowEntries(logRaw);
  const legacy = legacyNextSteps.trim();
  if (log.length === 0 && legacy) {
    log = [
      {
        id: "legacy-next-steps",
        text: legacy,
        createdAt: (updatedAt ?? new Date()).toISOString(),
      },
    ];
  }
  return log;
}
