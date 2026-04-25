// T1: Requirements — synthesize scanned files into a clean requirements object
// Detects contradictions (e.g. README says npm, but pnpm-lock.yaml exists)

import type { RepoRequirements } from "../types.js";

export interface Contradiction {
  field: string;
  sources: { file: string; value: string }[];
  recommendation: string;
}

export async function resolveRequirements(
  repoPath: string,
  rawScan: RepoRequirements
): Promise<{ requirements: RepoRequirements; contradictions: Contradiction[] }> {
  // TODO T1: Implement
  // 1. Check for lockfile vs packageManager field mismatches
  // 2. Check README commands vs actual config
  // 3. Merge CI config requirements with package.json requirements
  // 4. Return cleaned requirements + list of contradictions
  throw new Error("Not implemented");
}
