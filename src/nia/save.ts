// Nia save — save new fixes/knowledge to the Nia knowledge base

import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { KnownFix, ProjectConfig } from "../types.js";
import { getNiaArgs } from "./config.js";

export async function saveFix(fix: KnownFix): Promise<void> {
  const title = `Fix: ${fix.errorPattern}`;

  const meta: Record<string, string> = {};
  if (fix.os) meta.os = fix.os;
  if (fix.arch) meta.arch = fix.arch;
  if (fix.stepName) meta.stepName = fix.stepName;
  if (fix.toolVersions) {
    for (const [tool, version] of Object.entries(fix.toolVersions)) {
      meta[`tool_${tool}`] = version;
    }
  }

  const summary = `Fix for: ${fix.errorPattern}`;

  const content = [
    `Error: ${fix.errorPattern}`,
    `Fix: ${fix.fix}`,
    fix.command ? `Command: ${fix.command}` : "",
    Object.keys(meta).length
      ? `Metadata: ${JSON.stringify(meta)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const tags = ["setup-fix", fix.os, fix.arch, fix.stepName].filter(
    (t): t is string => !!t,
  );

  await execa("nia", getNiaArgs([
    "contexts",
    "save",
    title,
    "--summary",
    summary,
    "--content",
    content,
    "--agent",
    "first-run",
    "--tags",
    tags.join(","),
  ]));
}

export async function saveKnowledge(
  title: string,
  summary: string,
  content: string,
  tags?: string[],
): Promise<void> {
  const args = ["contexts", "save", title, "--summary", summary, "--content", content, "--agent", "first-run"];
  if (tags?.length) {
    args.push("--tags", tags.join(","));
  }
  await execa("nia", getNiaArgs(args));
}

async function getSourceId(repoPath: string): Promise<string | null> {
  try {
    const configPath = join(repoPath, ".first-run.json");
    const raw = await readFile(configPath, "utf-8");
    const config: ProjectConfig = JSON.parse(raw);
    return config.niaSourceId ?? null;
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function saveToSource(
  repoPath: string,
  title: string,
  content: string,
  category: string,
): Promise<{ sourceId: string; path: string }> {
  const sourceId = await getSourceId(repoPath);
  if (!sourceId) {
    throw new Error("No niaSourceId found. Run `first-run init` first to index this repo.");
  }

  const slug = slugify(title);
  const filePath = `knowledge/${category}/${slug}.md`;

  const body = [
    `# ${title}`,
    "",
    `Category: ${category}`,
    `Created: ${new Date().toISOString()}`,
    "",
    content,
  ].join("\n");

  await execa("nia", getNiaArgs([
    "sources",
    "write",
    sourceId,
    filePath,
    "--body",
    body,
    "--language",
    "markdown",
  ]));

  return { sourceId, path: filePath };
}
