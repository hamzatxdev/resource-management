/**
 * Flexible colon-separated tags. Any namespace is allowed.
 *
 * Examples:
 *   allocation:june:cis:4h     → June · CIS · 4h
 *   may:bench                  → May · bench
 *   certificate:devops:aws-developer-associate
 *   spec:full-stack:node       → spec tag (also feeds specializations)
 *   skill-focus:react
 *   client:acme:2024
 *   available
 */

export type ParsedTagType =
  | "allocation"
  | "period-label"
  | "certificate"
  | "spec"
  | "namespaced"
  | "freeform";

export interface ParsedTag {
  raw: string;
  type: ParsedTagType;
  /** Human-readable line for UI and AI */
  label: string;
  namespace?: string;
  parts: string[];
  period?: string;
  project?: string;
  hours?: string;
  status?: string;
}

const MONTHS: Record<string, string> = {
  jan: "January",
  january: "January",
  feb: "February",
  february: "February",
  mar: "March",
  march: "March",
  apr: "April",
  april: "April",
  may: "May",
  jun: "June",
  june: "June",
  jul: "July",
  july: "July",
  aug: "August",
  august: "August",
  sep: "September",
  sept: "September",
  september: "September",
  oct: "October",
  october: "October",
  nov: "November",
  november: "November",
  dec: "December",
  december: "December",
};

const NAMESPACE_LABELS: Record<string, string> = {
  allocation: "Allocation",
  certificate: "Certificate",
  cert: "Certificate",
  spec: "Specialization",
  skill: "Skill",
  "skill-focus": "Skill focus",
  client: "Client",
  project: "Project",
  status: "Status",
  team: "Team",
  language: "Language",
  framework: "Framework",
};

function humanPart(part: string): string {
  return part
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => (w.length <= 3 && /^[a-z]+$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function titlePeriod(part: string): string {
  const key = part.toLowerCase().trim();
  return MONTHS[key] ?? humanPart(part);
}

function formatHours(h: string): string {
  const t = h.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}h`;
  return h;
}

function labelFromParts(namespace: string | undefined, parts: string[]): string {
  const nsLabel = namespace ? NAMESPACE_LABELS[namespace.toLowerCase()] ?? humanPart(namespace) : undefined;
  const rest = parts.map(humanPart).join(" · ");
  if (nsLabel && rest) return `${nsLabel} · ${rest}`;
  if (nsLabel) return nsLabel;
  return rest || "";
}

export function parseTag(raw: string): ParsedTag {
  const tag = raw.trim();
  if (!tag) {
    return { raw: tag, type: "freeform", label: tag, parts: [] };
  }

  if (!tag.includes(":")) {
    return {
      raw: tag,
      type: "freeform",
      label: humanPart(tag),
      parts: [tag],
    };
  }

  const alloc = tag.match(/^allocation:([^:]+):([^:]+):(.+)$/i);
  if (alloc) {
    const period = titlePeriod(alloc[1]);
    const project = alloc[2].trim().toUpperCase();
    const hours = formatHours(alloc[3]);
    return {
      raw: tag,
      type: "allocation",
      label: `${period} · ${project} · ${hours}`,
      namespace: "allocation",
      parts: [alloc[1], alloc[2], alloc[3]],
      period: alloc[1],
      project: alloc[2],
      hours: alloc[3],
    };
  }

  const parts = tag.split(":").map((p) => p.trim()).filter(Boolean);
  const head = parts[0]?.toLowerCase() ?? "";

  if (parts.length === 2) {
    const periodKey = head;
    if (MONTHS[periodKey]) {
      const period = titlePeriod(parts[0]);
      const p2 = parts[1];
      const readable =
        p2.length <= 4 && /^[a-z]+$/i.test(p2)
          ? `${period} · ${p2.toUpperCase()}`
          : `${period} · ${humanPart(p2)}`;
      return {
        raw: tag,
        type: "period-label",
        label: readable,
        namespace: periodKey,
        parts,
        period: parts[0],
        status: parts[1],
      };
    }
  }

  if (head === "certificate" || head === "cert") {
    return {
      raw: tag,
      type: "certificate",
      label: labelFromParts("certificate", parts.slice(1)),
      namespace: head,
      parts,
    };
  }

  if (head === "spec") {
    return {
      raw: tag,
      type: "spec",
      label: labelFromParts("spec", parts.slice(1)),
      namespace: "spec",
      parts,
    };
  }

  return {
    raw: tag,
    type: "namespaced",
    label: labelFromParts(head, parts.slice(1)),
    namespace: head,
    parts,
  };
}

export function parseTags(tags: string[]): ParsedTag[] {
  return tags.filter(Boolean).map(parseTag);
}

/** Split pasted or typed tag text (comma, semicolon, or newline). */
export function parseTagsInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Map spec: tags to canonical specialization labels */
export function specializationFromSpecTag(tag: string): string | null {
  const p = parseTag(tag);
  if (p.type !== "spec") return null;
  const key = p.parts.slice(1).join(":").toLowerCase().replace(/\s+/g, "-");
  return SPEC_TAG_ALIASES[key] ?? p.parts.slice(1).map(humanPart).join(" ");
}

export const SPEC_TAG_ALIASES: Record<string, string> = {
  "full-stack:node": "Full Stack (Node)",
  "full-stack:python": "Full Stack (Python)",
  "full-stack:dotnet": "Full Stack (.NET)",
  "full-stack:net": "Full Stack (.NET)",
  "full-stack": "Full Stack",
  frontend: "Frontend",
  backend: "Backend",
  "backend:node": "Backend (Node)",
  "backend:dotnet": "Backend (.NET)",
  "ai-ml": "AI/ML",
  "ai/ml": "AI/ML",
  qa: "QA",
  devops: "DevOps",
  "devops:basic": "DevOps (Basic)",
  "tech-lead": "Tech Lead",
  "project-manager": "Project Manager",
};

export function specializationsFromTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const spec = specializationFromSpecTag(t);
    if (spec) out.push(spec);
  }
  return out;
}

export function tagsForAI(tags: string[]): string {
  if (!tags.length) return "No tags";
  return parseTags(tags)
    .map((t) => {
      const kind =
        t.type === "allocation"
          ? "allocation"
          : t.type === "certificate"
            ? "certificate"
            : t.type === "spec"
              ? "specialization tag"
              : t.type === "period-label"
                ? "period"
                : t.namespace ?? "tag";
      return `[${kind}] ${t.raw} → ${t.label}`;
    })
    .join("; ");
}

export function tagsReadableSummary(tags: string[]): string {
  const parsed = parseTags(tags);
  if (!parsed.length) return "";
  return parsed.map((t) => t.label).join(" · ");
}

export function tagMatchesFilter(memberTags: string[], filter: string): boolean {
  const f = filter.toLowerCase();
  return memberTags.some((t) => {
    const p = parseTag(t);
    const blob = [t, p.label, p.namespace, ...p.parts].join(" ").toLowerCase();
    return blob.includes(f);
  });
}

export const TAG_EXAMPLES = [
  "may:bench",
  "june:cis",
  "allocation:june:cis:4h",
  "certificate:devops:aws-developer-associate",
  "certificate:azure:az-104",
  "spec:full-stack:node",
  "spec:devops:basic",
  "skill-focus:react",
  "client:acme",
  "available",
];
