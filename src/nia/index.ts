// T2: Nia indexing — index a repo as a Nia source

import type { ProjectConfig } from "../types.js";

export async function indexRepo(repoPath: string): Promise<ProjectConfig> {
  // TODO T2: Implement
  // 1. Run `nia repos index` in the repo directory
  // 2. Capture the source ID from output
  // 3. Save config to .first-run.json
  // 4. Return ProjectConfig
  throw new Error("Not implemented");
}

export async function isRepoIndexed(repoPath: string): Promise<boolean> {
  // TODO T2: Check if .first-run.json exists and source is still valid
  throw new Error("Not implemented");
}
