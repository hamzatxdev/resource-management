import { memberMatchesFlagFilter } from "./aiFlags";
import { hasActiveProbation } from "./probation";
import type { AiFlag, ProbationFlag } from "./types";

/** Probation-only table filter: "" | "active" | "inactive" */
export function memberMatchesProbationFilter(
  probation: ProbationFlag | undefined,
  filter: string
): boolean {
  if (!filter) return true;
  if (filter === "active") return hasActiveProbation(probation);
  if (filter === "inactive") return !hasActiveProbation(probation);
  return true;
}

/** Staffing flag filter only. */
export function memberMatchesProfileFilter(
  aiFlags: AiFlag | undefined,
  filter: string
): boolean {
  if (!filter) return true;
  return memberMatchesFlagFilter(aiFlags, filter);
}
