import OpenAI from "openai";
import { z } from "zod";
import { uniqueCanonicalTags } from "./tags";
import {
  filterMembersByTagQuery,
  isStructuredTagQuery,
  parseTagQuery,
  type TagQueryFilter,
} from "./tagQueryFilter";
import {
  buildMemberSearchIndex,
  buildSearchIndexMap,
  filterMembersByQueryExpression,
  memberMatchesQueryExpression,
  type MemberSearchIndex,
  type QueryMember,
} from "./querySearch";

const NL_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const NlFilterSchema = z.object({
  query: z.string().optional(),
  requiredTags: z.array(z.string()).optional(),
  excludedTags: z.array(z.string()).optional(),
  flag: z.string().optional(),
  probation: z.enum(["active", "inactive"]).optional(),
  roleIncludes: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export type NlFilterResult = z.infer<typeof NlFilterSchema>;

const STAFFING_KEYWORDS =
  /\b(bench|allocated|allocation|assign|project|client|group:|allocated:|tag|probation|replacement|replace|flag|certificate|spec:|may|june|july|august|september|october|november|december|january|february|march|april|who is|show me|list|find people|on project)\b/i;

export function looksLikeStaffingQuestion(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (parseTagQuery(m)) return true;
  if (STAFFING_KEYWORDS.test(m)) return true;
  if (/[a-z]+:[\w-]+/i.test(m)) return true;
  return false;
}

function memberMatchesNlFilter(
  member: QueryMember,
  filter: NlFilterResult,
  indices: Map<string, MemberSearchIndex>
): boolean {
  const index = indices.get(member.id) ?? buildMemberSearchIndex(member);

  if (filter.requiredTags?.length) {
    for (const t of filter.requiredTags) {
      if (!memberMatchesQueryExpression(index, t)) return false;
    }
  }
  if (filter.excludedTags?.length) {
    for (const t of filter.excludedTags) {
      if (memberMatchesQueryExpression(index, t)) return false;
    }
  }
  if (filter.flag) {
    const want = filter.flag.toLowerCase();
    if (want === "staffing" || want === "flagged") {
      if (!index.flagged) return false;
    } else if (index.flag !== want) return false;
  }
  if (filter.probation === "active" && !index.probation) return false;
  if (filter.probation === "inactive" && index.probation) return false;
  if (filter.roleIncludes?.length) {
    const role = (member.role ?? "").toLowerCase();
    if (!filter.roleIncludes.some((r) => role.includes(r.toLowerCase()))) {
      return false;
    }
  }
  if (filter.query?.trim()) {
    if (!filterMembersByQueryExpression([member], indices, filter.query).length) {
      return false;
    }
  }
  return true;
}

function tagQueryToNlFilter(tq: TagQueryFilter): NlFilterResult {
  const parts: string[] = [];
  if (tq.staffing === "bench") parts.push("allocated:bench");
  if (tq.project) parts.push(`allocated:${tq.project}`);
  if (tq.namespace && tq.project) {
    parts.push(`${tq.namespace}:${tq.project}`);
  }
  const queryParts: string[] = [];
  if (tq.staffing === "bench") queryParts.push("allocated:bench");
  else if (tq.staffing === "allocated" && tq.project) {
    queryParts.push(`allocated:${tq.project}`);
  }
  return {
    query: queryParts.length ? queryParts.join(" and ") : undefined,
    requiredTags: parts.length ? parts : undefined,
    roleIncludes: tq.roleIncludes,
    summary: "Parsed staffing query",
  };
}

export async function interpretNaturalLanguageQuery(
  message: string,
  members: QueryMember[],
  apiKey: string
): Promise<{ filter: NlFilterResult; source: "rules" | "llm" } | null> {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const tagQuery = parseTagQuery(trimmed);
  if (isStructuredTagQuery(tagQuery) && tagQuery) {
    return { filter: tagQueryToNlFilter(tagQuery), source: "rules" };
  }

  if (!looksLikeStaffingQuestion(trimmed)) return null;

  const allTags = uniqueCanonicalTags(
    members.flatMap((m) => m.tags ?? []).filter(Boolean)
  );
  const tagSample = allTags.slice(0, 60).join(", ");

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: NL_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You convert natural-language staffing questions into structured filters for a team directory.

Tags use colon namespaces, e.g. allocated:bench, allocated:cis, group:sse, group:se, internal-project:pmo-engine, spec:full-stack:node.

Output JSON only:
{
  "query": "optional query expression using and/or/not, tag patterns (allocated:bench), flag:replacement, group:sse, skill:react",
  "requiredTags": ["tags that must ALL be present — use exact canonical tag strings when possible"],
  "excludedTags": ["tags that must NOT be present"],
  "flag": "none|ok|info|watch|action|replacement|staffing",
  "probation": "active|inactive",
  "roleIncludes": ["engineer"],
  "summary": "short label for UI"
}

Examples:
- "who is on bench" → {"requiredTags":["allocated:bench"],"summary":"On bench"}
- "replacement but not on bench" → {"query":"replace and not allocated:bench","flag":"replacement","summary":"Replacement, not bench"}
- "SSE on CIS" → {"query":"group:sse and allocated:cis","summary":"SSE on CIS"}
- "not allocated to bench" → {"excludedTags":["allocated:bench"],"summary":"Not on bench"}

Known tags (sample): ${tagSample}

Prefer "query" for compound logic. Use requiredTags/excludedTags when a single tag constraint is enough.`,
      },
      { role: "user", content: trimmed },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: NlFilterResult;
  try {
    parsed = NlFilterSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }

  const hasConstraint =
    parsed.query?.trim() ||
    parsed.requiredTags?.length ||
    parsed.excludedTags?.length ||
    parsed.flag ||
    parsed.probation ||
    parsed.roleIncludes?.length;

  if (!hasConstraint) return null;
  return { filter: parsed, source: "llm" };
}

export function applyNlFilter<T extends QueryMember>(
  members: T[],
  filter: NlFilterResult
): T[] {
  const indices = buildSearchIndexMap(members);
  return members.filter((m) => memberMatchesNlFilter(m, filter, indices));
}

export function filterMembersByNlOrTagQuery<T extends QueryMember>(
  members: T[],
  message: string,
  tagQuery: TagQueryFilter | null
): T[] {
  if (isStructuredTagQuery(tagQuery) && tagQuery) {
    return filterMembersByTagQuery(
      members.map((m) => ({
        id: m.id,
        tags: m.tags,
        role: m.role,
        projects: m.projects,
      })),
      tagQuery
    ) as T[];
  }
  return members;
}
