// T2: Nia indexing — index a repo as a Nia source

import { execa } from "execa";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types.js";

const CONFIG_FILE = ".first-run.json";

export async function indexRepo(repoPath: string): Promise<ProjectConfig> {
  const result = await execa("nia", ["repos", "index"], { cwd: repoPath });

  // Parse source ID from nia output
  const sourceIdMatch = result.stdout.match(/source[_\s-]?id[:\s]+(\S+)/i);
  const sourceId = sourceIdMatch?.[1] ?? result.stdout.trim();

  const repoName = repoPath.split("/").pop() ?? "unknown";

  const config: ProjectConfig = {
    niaSourceId: sourceId,
    repoName,
    createdAt: new Date().toISOString(),
    lastIndexed: new Date().toISOString(),
  };

  const configPath = join(repoPath, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2));

  return config;
}

export async function isRepoIndexed(repoPath: string): Promise<boolean> {
  try {
    const configPath = join(repoPath, CONFIG_FILE);
    const raw = await readFile(configPath, "utf-8");
    const config: ProjectConfig = JSON.parse(raw);
    return !!config.niaSourceId;
  } catch {
    return false;
  }
}
