// Nia search — search the knowledge base for setup info or error fixes

import { execa } from "execa";
import type { KnownFix } from "../types.js";
import { getNiaArgs } from "./config.js";

export async function searchForFixes(errorMessage: string): Promise<KnownFix[]> {
  const result = await execa("nia", getNiaArgs(["contexts", "search", errorMessage]));
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
  const result = await execa("nia", getNiaArgs(["search", query]));
  return result.stdout.trim();
}
