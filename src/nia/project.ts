// Shared helper to read project config from .first-run.json

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types.js";

export async function getRepoName(repoPath?: string): Promise<string | null> {
  const cwd = repoPath ?? process.cwd();
  try {
    const raw = await readFile(join(cwd, ".first-run.json"), "utf-8");
    const config: ProjectConfig = JSON.parse(raw);
    return config.repoName ?? null;
  } catch {
    return null;
  }
}
