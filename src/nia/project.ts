// Shared helper to read project config from .first-run.json

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types.js";

export async function getProjectConfig(repoPath?: string): Promise<ProjectConfig | null> {
  const cwd = repoPath ?? process.cwd();
  try {
    const raw = await readFile(join(cwd, ".first-run.json"), "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function getRepoTag(repoPath?: string): Promise<string | null> {
  const config = await getProjectConfig(repoPath);
  if (!config) return null;
  // Use sourceId as the stable tag — folder names can change, this won't
  return config.niaSourceId ?? null;
}
