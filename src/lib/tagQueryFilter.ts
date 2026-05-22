import { parseTag, parseTags, type ParsedTag } from "./tags";

const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
] as const;

const MONTH_ALIASES: Record<string, string> = {
  january: "january",
  jan: "january",
  february: "february",
  feb: "february",
  march: "march",
  mar: "march",
  april: "april",
  apr: "april",
  may: "may",
  june: "june",
  jun: "june",
  july: "july",
  jul: "july",
  august: "august",
  aug: "august",
  september: "september",
  sep: "september",
  sept: "september",
  october: "october",
  oct: "october",
  november: "november",
  nov: "november",
  december: "december",
  dec: "december",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "who",
  "is",
  "are",
  "with",
  "and",
  "or",
  "has",
  "have",
  "people",
  "person",
  "team",
  "member",
  "members",
  "allocated",
  "allocation",
  "allocate",
  "assign",
  "assigned",
  "bench",
  "available",
  "show",
  "find",
  "list",
]);

export type StaffingIntent = "bench" | "allocated";

export interface TagQueryFilter {
  periods: string[];
  staffing?: StaffingIntent;
  project?: string;
  namespace?: string;
}

function canonicalMonth(key: string): string | null {
  const k = key.toLowerCase().trim();
  return MONTH_ALIASES[k] ?? null;
}

export function periodsEqual(a: string, b: string): boolean {
  const ca = canonicalMonth(a);
  const cb = canonicalMonth(b);
  if (ca && cb) return ca === cb;
  return a.toLowerCase() === b.toLowerCase();
}

function extractPeriods(message: string): string[] {
  const lower = message.toLowerCase();
  const found = new Set<string>();
  for (const key of MONTH_KEYS) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(lower)) {
      const canon = canonicalMonth(key);
      if (canon) found.add(canon);
    }
  }
  return [...found];
}

function extractStaffing(message: string): StaffingIntent | undefined {
  const lower = message.toLowerCase();
  if (/\b(on\s+)?bench\b/.test(lower)) return "bench";
  if (/\b(allocated|allocation|on\s+project|assigned)\b/.test(lower)) {
    return "allocated";
  }
  return undefined;
}

function extractProject(message: string, periods: string[]): string | undefined {
  const lower = message.toLowerCase();
  const m = lower.match(
    /\b(?:allocated|allocation|on|at|to|for)\s+(?:in\s+\w+\s+)?([a-z][\w-]{1,20})\b/
  );
  if (m && !STOP_WORDS.has(m[1]) && !MONTH_ALIASES[m[1]]) return m[1];

  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (STOP_WORDS.has(t) || MONTH_ALIASES[t]) continue;
    if (t.length >= 2 && t.length <= 16 && periods.length > 0) return t;
  }
  return undefined;
}

function extractNamespace(message: string): string | undefined {
  const m = message.toLowerCase().match(
    /\b(client|project|spec|certificate|cert|allocation):(\S+)/
  );
  return m ? m[1] : undefined;
}

/** Parse natural-language staffing/tag questions into structured filters. */
export function parseTagQuery(message: string): TagQueryFilter | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const periods = extractPeriods(trimmed);
  const staffing = extractStaffing(trimmed);
  const project = extractProject(trimmed, periods);
  const namespace = extractNamespace(trimmed);

  if (!periods.length && !staffing && !project && !namespace) return null;

  return {
    periods,
    staffing,
    project,
    namespace,
  };
}

export function isStructuredTagQuery(
  filter: TagQueryFilter | null
): filter is TagQueryFilter {
  if (!filter) return false;
  return !!(
    filter.periods.length ||
    filter.staffing ||
    filter.project ||
    filter.namespace
  );
}

function tagPeriodKey(tag: ParsedTag): string | undefined {
  if (tag.period) return tag.period;
  if (tag.type === "period-label" && tag.parts[0]) return tag.parts[0];
  if (tag.type === "allocation" && tag.parts[0]) return tag.parts[0];
  return undefined;
}

function tagProjectKey(tag: ParsedTag): string | undefined {
  if (tag.project) return tag.project;
  if (tag.type === "period-label" && tag.parts[1]) return tag.parts[1];
  return undefined;
}

function periodConstraintOk(tag: ParsedTag, periods: string[]): boolean {
  if (!periods.length) return true;
  const tp = tagPeriodKey(tag);
  if (!tp) return false;
  return periods.some((p) => periodsEqual(tp, p));
}

function projectConstraintOk(tag: ParsedTag, project: string): boolean {
  const tp = tagProjectKey(tag);
  if (!tp) return false;
  const want = project.toLowerCase();
  return tp.toLowerCase().includes(want) || want.includes(tp.toLowerCase());
}

function tagMatchesStructuredFilter(
  tag: ParsedTag,
  filter: TagQueryFilter
): boolean {
  if (filter.namespace) {
    const ns = tag.namespace?.toLowerCase();
    if (ns !== filter.namespace.toLowerCase()) return false;
    if (filter.project && !projectConstraintOk(tag, filter.project)) {
      return false;
    }
    return periodConstraintOk(tag, filter.periods);
  }

  if (filter.staffing === "bench") {
    if (tag.type !== "period-label" && tag.type !== "freeform") return false;
    const status = tag.status?.toLowerCase() ?? tag.parts[1]?.toLowerCase() ?? "";
    if (status !== "bench" && !tag.label.toLowerCase().includes("bench")) {
      return false;
    }
    return periodConstraintOk(tag, filter.periods);
  }

  if (filter.staffing === "allocated") {
    if (tag.type === "allocation") {
      if (!periodConstraintOk(tag, filter.periods)) return false;
      if (filter.project && !projectConstraintOk(tag, filter.project)) {
        return false;
      }
      return true;
    }
    if (tag.type === "period-label") {
      const status = tag.status?.toLowerCase() ?? tag.parts[1]?.toLowerCase() ?? "";
      if (status === "bench") return false;
      if (!periodConstraintOk(tag, filter.periods)) return false;
      if (filter.project && !projectConstraintOk(tag, filter.project)) {
        return false;
      }
      return true;
    }
    return false;
  }

  if (filter.periods.length) {
    if (tag.type === "allocation" || tag.type === "period-label") {
      if (filter.project && !projectConstraintOk(tag, filter.project)) {
        return false;
      }
      return periodConstraintOk(tag, filter.periods);
    }
    return false;
  }

  if (filter.project) {
    return projectConstraintOk(tag, filter.project);
  }

  return false;
}

export function memberMatchesTagQuery(
  tags: string[],
  filter: TagQueryFilter
): boolean {
  if (!tags.length) return false;
  return parseTags(tags).some((tag) => tagMatchesStructuredFilter(tag, filter));
}

export function filterMembersByTagQuery<
  T extends { id: string; tags?: string[] },
>(members: T[], filter: TagQueryFilter): T[] {
  return members.filter((m) => memberMatchesTagQuery(m.tags ?? [], filter));
}
