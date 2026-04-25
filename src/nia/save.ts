// T2: Nia save — save new fixes/knowledge to the Nia knowledge base

import { execa } from "execa";
import type { KnownFix } from "../types.js";

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

  await execa("nia", [
    "contexts",
    "save",
    "--title",
    title,
    "--content",
    content,
    "--tags",
    tags.join(","),
  ]);
}

export async function saveKnowledge(
  title: string,
  content: string,
  tags?: string[],
): Promise<void> {
  const args = ["contexts", "save", "--title", title, "--content", content];
  if (tags?.length) {
    args.push("--tags", tags.join(","));
  }
  await execa("nia", args);
}
