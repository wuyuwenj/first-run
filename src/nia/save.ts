// Nia save — save new fixes/knowledge to the Nia knowledge base

import { execa } from "execa";
import type { KnownFix } from "../types.js";
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
    "--memory-type",
    "fact",
  ]));
}

export async function saveKnowledge(
  title: string,
  content: string,
  category: string,
  tags?: string[],
): Promise<void> {
  const summary = `${category}: ${title}`;
  const allTags = [category, ...(tags ?? [])];
  const args = [
    "contexts", "save", title,
    "--summary", summary,
    "--content", content,
    "--agent", "first-run",
    "--memory-type", "fact",
    "--tags", allTags.join(","),
  ];
  await execa("nia", getNiaArgs(args));
}
