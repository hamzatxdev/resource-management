import { normalizeSeverity } from "./aiFlags";
import { hasActiveProbation } from "./probation";
import { normalizeTagPart, parseTag, tagCanonicalKey } from "./tags";
import type { AiFlag, ProbationFlag, TeamMemberClient } from "./types";

/** Searchable member row (client or server). */
export type QueryMember = Pick<
  TeamMemberClient,
  | "id"
  | "name"
  | "role"
  | "email"
  | "specialization"
  | "specializations"
  | "stackLabel"
  | "tags"
  | "skills"
  | "projects"
  | "notes"
  | "aiFlags"
  | "probation"
> & {
  stacks?: string[];
};

export type MemberSearchIndex = {
  id: string;
  tagKeys: string[];
  flag: string;
  flagged: boolean;
  probation: boolean;
  role: string;
  specs: string[];
  skills: string[];
  stacks: string[];
  projects: string[];
  name: string;
  idLower: string;
  email: string;
  notes: string;
  /** Lowercased concatenation for bare-word search. */
  blob: string;
};

const QUERY_FIELDS = new Set([
  "tag",
  "tags",
  "flag",
  "probation",
  "role",
  "spec",
  "specialization",
  "skill",
  "skills",
  "stack",
  "project",
  "name",
  "id",
  "email",
  "group",
  "notes",
]);

const BOOL_OPS = new Set(["and", "or", "not"]);

const WORD_ALIASES: Record<string, QueryTerm> = {
  replace: { kind: "field", field: "flag", value: "replacement" },
  replacement: { kind: "field", field: "flag", value: "replacement" },
  bench: { kind: "tag", pattern: "allocated:bench" },
  onbench: { kind: "tag", pattern: "allocated:bench" },
  probation: { kind: "field", field: "probation", value: "active" },
};

type QueryTerm =
  | { kind: "word"; value: string }
  | { kind: "tag"; pattern: string }
  | { kind: "field"; field: string; value: string };

type QueryNode =
  | { type: "and"; nodes: QueryNode[] }
  | { type: "or"; nodes: QueryNode[] }
  | { type: "not"; node: QueryNode }
  | { type: "term"; term: QueryTerm };

export function buildMemberSearchIndex(m: QueryMember): MemberSearchIndex {
  const specs = m.specializations?.length
    ? m.specializations
    : [m.specialization];
  const stacks = [...new Set([m.stackLabel, ...(m.stacks ?? [])])].filter(
    Boolean
  );
  const flag = normalizeSeverity(m.aiFlags?.severity);
  const parts = [
    m.id,
    m.name,
    m.role,
    m.email,
    ...specs,
    ...stacks,
    ...(m.tags ?? []),
    ...(m.skills ?? []),
    ...(m.projects ?? []),
    m.notes ?? "",
    m.aiFlags?.summary ?? "",
    ...(m.aiFlags?.reasons ?? []),
    flag,
    m.probation?.summary ?? "",
    ...(m.probation?.reasons ?? []),
    hasActiveProbation(m.probation) ? "probation active" : "",
  ];

  return {
    id: m.id,
    tagKeys: (m.tags ?? []).map((t) => tagCanonicalKey(t)),
    flag,
    flagged: Boolean(m.aiFlags?.flagged),
    probation: hasActiveProbation(m.probation),
    role: (m.role ?? "").toLowerCase(),
    specs: specs.map((s) => s.toLowerCase()),
    skills: (m.skills ?? []).map((s) => s.toLowerCase()),
    stacks: stacks.map((s) => s.toLowerCase()),
    projects: (m.projects ?? []).map((s) => s.toLowerCase()),
    name: (m.name ?? "").toLowerCase(),
    idLower: (m.id ?? "").toLowerCase(),
    email: (m.email ?? "").toLowerCase(),
    notes: (m.notes ?? "").toLowerCase(),
    blob: parts.join(" ").toLowerCase(),
  };
}

function tagPatternMatch(tagKeys: string[], pattern: string): boolean {
  const want = tagCanonicalKey(pattern);
  if (!want) return false;
  const wantParts = want.split(":");

  return tagKeys.some((key) => {
    if (key === want) return true;
    if (key.startsWith(`${want}:`)) return true;
    if (want.includes(":") && key.endsWith(`:${want.split(":").pop()}`)) {
      // loose tail match for partial patterns
    }
    const parsed = parseTag(key);
    const hay = [
      key,
      parsed.label.toLowerCase(),
      parsed.namespace?.toLowerCase() ?? "",
      ...parsed.parts.map((p) => normalizeTagPart(p)),
    ].join(" ");
    if (hay.includes(want.replace(/:/g, " "))) return true;
    if (wantParts.length >= 2) {
      const ns = wantParts[0];
      const rest = wantParts.slice(1).join(":");
      if (parsed.namespace?.toLowerCase() === ns) {
        if (parsed.parts.some((p) => normalizeTagPart(p).includes(rest))) {
          return true;
        }
      }
      if (key.startsWith(`${ns}:`) && key.includes(rest)) return true;
    }
    return key.includes(want);
  });
}

function fieldMatch(index: MemberSearchIndex, field: string, value: string): boolean {
  const v = value.toLowerCase().trim();
  switch (field) {
    case "tag":
    case "tags":
      return tagPatternMatch(index.tagKeys, v);
    case "flag":
      if (v === "staffing" || v === "flagged") return index.flagged;
      if (v === "none") return index.flag === "none" && !index.flagged;
      return index.flag === normalizeSeverity(v);
    case "probation":
      if (v === "active" || v === "yes" || v === "true") return index.probation;
      if (v === "inactive" || v === "no" || v === "false") return !index.probation;
      return index.probation && index.blob.includes(v);
    case "role":
      return index.role.includes(v);
    case "spec":
    case "specialization":
      return index.specs.some((s) => s.includes(v));
    case "skill":
    case "skills":
      return index.skills.some((s) => s.includes(v));
    case "stack":
      return index.stacks.some((s) => s.includes(v));
    case "project":
      return index.projects.some((s) => s.includes(v));
    case "name":
      return index.name.includes(v);
    case "id":
      return index.idLower.includes(v);
    case "email":
      return index.email.includes(v);
    case "group":
      return tagPatternMatch(index.tagKeys, `group:${v}`);
    case "notes":
      return index.notes.includes(v);
    default:
      return index.blob.includes(v);
  }
}

function termMatch(index: MemberSearchIndex, term: QueryTerm): boolean {
  if (term.kind === "tag") return tagPatternMatch(index.tagKeys, term.pattern);
  if (term.kind === "field") return fieldMatch(index, term.field, term.value);
  const word = term.value.toLowerCase();
  if (QUERY_FIELDS.has(word)) return true;
  return index.blob.includes(word);
}

function evalNode(index: MemberSearchIndex, node: QueryNode): boolean {
  switch (node.type) {
    case "and":
      return node.nodes.every((n) => evalNode(index, n));
    case "or":
      return node.nodes.some((n) => evalNode(index, n));
    case "not":
      return !evalNode(index, node.node);
    case "term":
      return termMatch(index, node.term);
  }
}

function parseTermToken(raw: string): QueryTerm {
  const token = raw.trim();
  if (!token) return { kind: "word", value: "" };

  const alias = WORD_ALIASES[token.toLowerCase()];
  if (alias) return alias;

  const colon = token.indexOf(":");
  if (colon > 0) {
    const head = token.slice(0, colon).toLowerCase();
    const rest = token.slice(colon + 1);
    if (QUERY_FIELDS.has(head)) {
      return { kind: "field", field: head, value: rest };
    }
    return { kind: "tag", pattern: token.toLowerCase() };
  }

  return { kind: "word", value: token };
}

type Tok =
  | { t: "word"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "and" }
  | { t: "or" }
  | { t: "not" };

function tokenize(input: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i++;
      continue;
    }
    if (s[i] === "(") {
      out.push({ t: "lparen" });
      i++;
      continue;
    }
    if (s[i] === ")") {
      out.push({ t: "rparen" });
      i++;
      continue;
    }
    if (s[i] === '"') {
      i++;
      let q = "";
      while (i < s.length && s[i] !== '"') {
        q += s[i++];
      }
      if (s[i] === '"') i++;
      out.push({ t: "word", v: q });
      continue;
    }
    let word = "";
    while (i < s.length && !/\s/.test(s[i]) && s[i] !== "(" && s[i] !== ")") {
      word += s[i++];
    }
    const lower = word.toLowerCase();
    if (BOOL_OPS.has(lower)) {
      out.push({ t: lower as "and" | "or" | "not" });
    } else if (word) {
      out.push({ t: "word", v: word });
    }
  }
  return out;
}

class Parser {
  private pos = 0;
  private tokens: Tok[];

  constructor(tokens: Tok[]) {
    this.tokens = tokens;
  }

  peek(): Tok | undefined {
    return this.tokens[this.pos];
  }

  consume(): Tok | undefined {
    return this.tokens[this.pos++];
  }

  parse(): QueryNode | null {
    if (!this.tokens.length) return null;
    const node = this.parseOr();
    return node;
  }

  private parseOr(): QueryNode {
    let left = this.parseAnd();
    while (this.peek()?.t === "or") {
      this.consume();
      const nodes = [left, this.parseAnd()];
      while (this.peek()?.t === "or") {
        this.consume();
        nodes.push(this.parseAnd());
      }
      left = { type: "or", nodes };
    }
    return left;
  }

  private parseAnd(): QueryNode {
    let nodes: QueryNode[] = [this.parseNot()];
    while (this.peek()?.t === "and") {
      this.consume();
      nodes.push(this.parseNot());
    }
    if (nodes.length === 1) return nodes[0];
    return { type: "and", nodes };
  }

  private parseNot(): QueryNode {
    if (this.peek()?.t === "not") {
      this.consume();
      return { type: "not", node: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const tok = this.peek();
    if (tok?.t === "lparen") {
      this.consume();
      const inner = this.parseOr();
      if (this.peek()?.t === "rparen") this.consume();
      return inner;
    }
    const word = this.consume();
    if (!word || word.t !== "word") {
      return { type: "term", term: { kind: "word", value: "" } };
    }
    return { type: "term", term: parseTermToken(word.v) };
  }
}

const parseCache = new Map<string, QueryNode | null>();

export function parseQueryExpression(input: string): QueryNode | null {
  const q = input.trim();
  if (!q) return null;
  const cached = parseCache.get(q);
  if (cached !== undefined) return cached;

  const tokens = tokenize(q);
  if (!tokens.length) {
    parseCache.set(q, null);
    return null;
  }

  // Implicit AND between adjacent terms (e.g. "react node" → react AND node)
  const withAnd: Tok[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    withAnd.push(cur);
    const next = tokens[i + 1];
    if (!next) break;
    const curIsValue = cur.t === "word" || cur.t === "rparen";
    const nextIsValue = next.t === "word" || next.t === "lparen" || next.t === "not";
    const nextIsOp = next.t === "and" || next.t === "or";
    if (curIsValue && nextIsValue && !nextIsOp) {
      withAnd.push({ t: "and" });
    }
  }

  const ast = new Parser(withAnd).parse();
  parseCache.set(q, ast);
  if (parseCache.size > 200) {
    const first = parseCache.keys().next().value;
    if (first) parseCache.delete(first);
  }
  return ast;
}

export function memberMatchesQueryExpression(
  index: MemberSearchIndex,
  query: string
): boolean {
  const ast = parseQueryExpression(query);
  if (!ast) return true;
  return evalNode(index, ast);
}

export function filterMembersByQueryExpression<T extends QueryMember>(
  members: T[],
  indices: Map<string, MemberSearchIndex>,
  query: string
): T[] {
  const q = query.trim();
  if (!q) return members;
  return members.filter((m) => {
    const index = indices.get(m.id);
    if (!index) return false;
    return memberMatchesQueryExpression(index, q);
  });
}

export function buildSearchIndexMap(
  members: QueryMember[]
): Map<string, MemberSearchIndex> {
  const map = new Map<string, MemberSearchIndex>();
  for (const m of members) {
    map.set(m.id, buildMemberSearchIndex(m));
  }
  return map;
}

export const QUERY_SEARCH_HINT =
  'Query: replace and not allocated:bench · group:sse and skill:react · flag:watch or probation:active';

export const QUERY_SEARCH_PLACEHOLDER =
  "Query search — replace and not allocated:bench, group:sse, flag:watch…";
