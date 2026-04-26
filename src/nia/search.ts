// Nia search — search the knowledge base for setup info or error fixes

import { execa } from "execa";
import type { KnownFix } from "../types.js";
import { getNiaArgs } from "./config.js";
import { getRepoName } from "./project.js";

export async function searchForFixes(errorMessage: string): Promise<KnownFix[]> {
  const repoName = await getRepoName();
  const args = ["contexts", "search", errorMessage];
  if (repoName) args.push("--tags", repoName);
  const result = await execa("nia", getNiaArgs(args));
  const output = result.stdout.trim();
  if (!output) return [];

  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : parsed.results ?? [];

    return items.map((item: Record<string, unknown>) => ({
      id: item.id as string | undefined,
      errorPattern: (item.errorPattern as string) ?? (item.title as string) ?? errorMessage,
      os: item.os as string | undefined,
      arch: item.arch as string | undefined,
      toolVersions: item.toolVersions as Record<string, string> | undefined,
      fix: (item.fix as string) ?? (item.content as string) ?? "",
      command: item.command as string | undefined,
      contributor: item.contributor as string | undefined,
      stepName: item.stepName as string | undefined,
      createdAt: item.createdAt as string | undefined,
    }));
  } catch {
    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        errorPattern: errorMessage,
        fix: line,
      }));
  }
}

export async function searchRepo(query: string): Promise<string> {
  // Search contexts first (where first-run saves knowledge), scoped to this repo
  const repoName = await getRepoName();
  const searchArgs = ["contexts", "search", query];
  if (repoName) searchArgs.push("--tags", repoName);
  const contextResult = await execa("nia", getNiaArgs(searchArgs));
  const contextOutput = contextResult.stdout.trim();
  if (contextOutput && !contextOutput.startsWith("No matching")) {
    // Extract context IDs and fetch full content
    const idMatches = [...contextOutput.matchAll(/id:\s+(\S+)/g)];
    if (idMatches.length > 0) {
      const details = await Promise.all(
        idMatches.slice(0, 5).map(async (match) => {
          try {
            const detail = await execa("nia", getNiaArgs(["contexts", "get", match[1]]));
            return detail.stdout.trim();
          } catch {
            return null;
          }
        }),
      );
      const results = details.filter(Boolean).join("\n\n---\n\n");
      if (results) return results;
    }
    return contextOutput;
  }

  // Fall back to universal search across indexed sources
  const result = await execa("nia", getNiaArgs(["search", "universal", query]));
  return result.stdout.trim();
}
