import { normalizeTagPart, parseTag, parseTags, type ParsedTag } from "./tags";

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

const ROLE_TERMS = [
  "developer",
  "engineer",
  "devops",
  "manager",
  "lead",
  "qa",
  "analyst",
  "architect",
  "intern",
  "consultant",
] as const;

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
  "project",
  "client",
  ...ROLE_TERMS,
]);

export type StaffingIntent = "bench" | "allocated";

export interface TagQueryFilter {
  periods: string[];
  staffing?: StaffingIntent;
  project?: string;
  namespace?: string;
  roleIncludes?: string[];
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

function extractRoleTerms(message: string): string[] {
  const lower = message.toLowerCase();
  return ROLE_TERMS.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(lower));
}

function isValidProjectToken(token: string, exclude: Set<string>): boolean {
  const t = token.toLowerCase();
  if (!t || t.length < 2 || t.length > 24) return false;
  if (STOP_WORDS.has(t) || MONTH_ALIASES[t] || exclude.has(t)) return false;
  return true;
}

function extractProject(
  message: string,
  periods: string[],
  roleTerms: string[]
): string | undefined {
  const lower = message.toLowerCase();
  const exclude = new Set(roleTerms);

  const colon = lower.match(/\b(?:project|client):([a-z][\w-]+)/i);
  if (colon && isValidProjectToken(colon[1], exclude)) return colon[1];

  const projectIs = lower.match(
    /\bproject\s+is\s+([a-z][\w-]+)(?:\s+and\s+|\s|$)/i
  );
  if (projectIs && isValidProjectToken(projectIs[1], exclude)) {
    return projectIs[1];
  }

  const onProject = lower.match(
    /\b(?:on|at|for)\s+(?:the\s+)?(?:project\s+)?([a-z][\w-]+)\b/i
  );
  if (onProject && isValidProjectToken(onProject[1], exclude)) {
    return onProject[1];
  }

  const alloc = lower.match(
    /\b(?:allocated|allocation)\s+(?:to|on|at|for)\s+(?:project\s+)?([a-z][\w-]+)\b/i
  );
  if (alloc && isValidProjectToken(alloc[1], exclude)) return alloc[1];

  const legacy = lower.match(
    /\b(?:allocated|allocation|on|at|to|for)\s+(?:in\s+\w+\s+)?([a-z][\w-]{1,20})\b/
  );
  if (legacy && isValidProjectToken(legacy[1], exclude)) return legacy[1];

  if (periods.length) {
    const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
    for (const t of tokens) {
      if (isValidProjectToken(t, exclude)) return t;
    }
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
  const roleIncludes = extractRoleTerms(trimmed);
  const project = extractProject(trimmed, periods, roleIncludes);
  const namespace = extractNamespace(trimmed);

  if (
    !periods.length &&
    !staffing &&
    !project &&
    !namespace &&
    !roleIncludes.length
  ) {
    return null;
  }

  return {
    periods,
    staffing,
    project,
    namespace,
    roleIncludes: roleIncludes.length ? roleIncludes : undefined,
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
    filter.namespace ||
    filter.roleIncludes?.length
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
  const ns = tag.namespace?.toLowerCase();
  if (
    (ns === "project" ||
      ns === "client" ||
      ns === "allocated" ||
      ns === "allocation") &&
    tag.parts.length >= 2
  ) {
    return tag.parts[1];
  }
  if (ns === "client" && tag.parts[0]) return tag.parts[0];
  if (tag.type === "period-label" && tag.parts[1]) return tag.parts[1];
  if (tag.type === "allocation" && tag.parts[1]) return tag.parts[1];
  return undefined;
}

function projectTokenMatch(want: string, got: string): boolean {
  const w = normalizeTagPart(want);
  const g = normalizeTagPart(got);
  if (!w || !g) return false;
  if (g === w) return true;
  return g.split(/[\s·:_-]+/).some((part) => part === w);
}

function periodConstraintOk(tag: ParsedTag, periods: string[]): boolean {
  if (!periods.length) return true;
  const tp = tagPeriodKey(tag);
  if (!tp) return false;
  return periods.some((p) => periodsEqual(tp, p));
}

function projectConstraintOk(tag: ParsedTag, project: string): boolean {
  const tp = tagProjectKey(tag);
  if (tp && projectTokenMatch(project, tp)) return true;
  const raw = tag.raw.toLowerCase();
  const label = tag.label.toLowerCase();
  const needle = project.toLowerCase();
  if (raw.includes(`:${needle}`) || raw.includes(`:${needle}:`)) return true;
  if (label.split("·").some((p) => projectTokenMatch(project, p.trim()))) {
    return true;
  }
  return false;
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

function memberProjectsMatch(
  projects: string[] | undefined,
  project: string
): boolean {
  const want = project.toLowerCase();
  return (projects ?? []).some(
    (p) =>
      p.toLowerCase() === want ||
      projectTokenMatch(project, p) ||
      p.toLowerCase().includes(want)
  );
}

function memberRoleMatch(role: string | undefined, terms: string[]): boolean {
  const r = (role ?? "").toLowerCase();
  return terms.some((t) => r.includes(t.toLowerCase()));
}

function memberMatchesProjectConstraint(
  member: { tags?: string[]; projects?: string[] },
  filter: TagQueryFilter
): boolean {
  if (!filter.project) return true;
  const tagOk = memberMatchesTagQuery(member.tags ?? [], {
    periods: filter.periods,
    staffing: filter.staffing,
    project: filter.project,
    namespace: filter.namespace,
  });
  if (tagOk) return true;
  return memberProjectsMatch(member.projects, filter.project);
}

export function memberMatchesQuery(
  member: {
    tags?: string[];
    role?: string;
    projects?: string[];
  },
  filter: TagQueryFilter
): boolean {
  if (filter.roleIncludes?.length) {
    if (!memberRoleMatch(member.role, filter.roleIncludes)) return false;
  }

  const needsTagOrProject =
    !!filter.project ||
    !!filter.staffing ||
    filter.periods.length > 0 ||
    !!filter.namespace;

  if (needsTagOrProject) {
    if (filter.project) {
      return memberMatchesProjectConstraint(member, filter);
    }
    return memberMatchesTagQuery(member.tags ?? [], filter);
  }

  return true;
}

export function filterMembersByTagQuery<
  T extends {
    id: string;
    tags?: string[];
    role?: string;
    projects?: string[];
  },
>(members: T[], filter: TagQueryFilter): T[] {
  return members.filter((m) => memberMatchesQuery(m, filter));
}
