// Nia indexing — index a repo as a Nia source

import { execa } from "execa";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types.js";
import { getNiaArgs } from "./config.js";

const CONFIG_FILE = ".first-run.json";

async function getGitHubSlug(repoPath: string): Promise<string | null> {
  try {
    const result = await execa("git", ["remote", "get-url", "origin"], { cwd: repoPath });
    const url = result.stdout.trim();
    const match = url.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractId(stdout: string): string | null {
  // Try project_id, source_id, or id fields
  const match = stdout.match(/(?:project_id|source[_\s-]?id|^id)[:\s]+(\S+)/im);
  return match?.[1] ?? null;
}

async function resolveSourceId(identifier: string): Promise<string | null> {
  try {
    const result = await execa("nia", getNiaArgs(["sources", "resolve", identifier]));
    const match = result.stdout.match(/^id[:\s]+(\S+)/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function indexRepo(repoPath: string): Promise<ProjectConfig> {
  const slug = await getGitHubSlug(repoPath);
  let sourceId: string;

  if (slug) {
    const result = await execa("nia", getNiaArgs(["repos", "index", slug]), { cwd: repoPath });
    sourceId = extractId(result.stdout) ?? await resolveSourceId(slug) ?? result.stdout.trim();
  } else {
    const result = await execa("nia", getNiaArgs(["local", "add", repoPath]));
    sourceId = extractId(result.stdout) ?? result.stdout.trim();
  }

  const repoName = repoPath.split("/").pop() ?? "unknown";

  const config: ProjectConfig = {
    niaSourceId: sourceId,
    repoName,
    repoUrl: slug ? `https://github.com/${slug}` : undefined,
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
