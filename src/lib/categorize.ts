import {
  detectGranularSpecializations,
  primarySpecialization,
} from "./specializations";
import type { Specialization, Stack, TeamMemberInput } from "./types";

export const FRONTEND_PATTERNS =
  /^(react|next|angular|vue|html|css|tailwind|sass|scss|less|jquery|bootstrap|chakra|material ui|ant design|antd|semantic ui|bulma|blazor|figma|mui|woocommerce|wordpress)/i;
export const BACKEND_PATTERNS =
  /(^node|^nest|^express|\.net|c#|asp\.net|django|flask|fastapi|spring|laravel|^php|microservices|graphql|rest api|signalr|grpc|webapi)/i;
export const AI_PATTERNS =
  /(machine learning|deep learning|^ai$|^ml$|langchain|langraph|langgraph|^rag|llm|hugging|computer vision|fine-tuning|fine tuning|agentic ai|model finetuning|opencv|nlp|spacy|nltk)/i;
export const QA_PATTERNS =
  /(jest|cypress|playwright|selenium|jmeter|postman|^test|jira|swagger|reflect|testmo|testrail|clickup|xray|functional testing)/i;

/** @deprecated use detectGranularSpecializations */
export function detectSpecialization(
  member: Pick<TeamMemberInput, "role" | "skills" | "tags">
): Specialization {
  const primary = primarySpecialization(
    detectGranularSpecializations(member)
  );
  return primary as Specialization;
}

export { detectGranularSpecializations, mergeSpecializations, primarySpecialization } from "./specializations";

export function detectStacks(skills: string[]): Stack[] {
  const lower = skills.map((s) => s.toLowerCase());
  const has = (re: RegExp) => lower.some((s) => re.test(s));

  const hasMongo = has(/mongo/);
  const hasPg = has(/postgres|psql/);
  const hasAngular = has(/angular/);
  const hasNode = has(/node/);
  const hasExpressOrNest = has(/express|nest/);
  const hasDotNet = has(/\.net|asp\.net|c#/);
  const hasPython = lower.includes("python") || has(/^python/);
  const hasAI = skills.some((s) => AI_PATTERNS.test(s));
  const hasRN = has(/react native/);
  const hasWP = has(/wordpress/);
  const hasReactWeb =
    has(/^react($|\.js$|js$)/) || has(/^next/) || lower.some((s) => s === "react");

  const stacks: Stack[] = [];
  if (hasMongo && hasReactWeb && hasNode && hasExpressOrNest) stacks.push("MERN");
  if (hasMongo && hasAngular && hasNode && hasExpressOrNest) stacks.push("MEAN");
  if (hasPg && hasReactWeb && hasNode && hasExpressOrNest) stacks.push("PERN");
  if (hasDotNet) stacks.push(".NET");
  if (hasPython && hasAI) stacks.push("Python / AI");
  if (hasRN) stacks.push("React Native");
  if (hasWP) stacks.push("WordPress");
  return stacks;
}
