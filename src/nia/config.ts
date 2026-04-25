// Shared Nia config — loads API key from env var or .env file

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedApiKey: string | undefined;

export function getNiaApiKey(): string | undefined {
  if (cachedApiKey !== undefined) return cachedApiKey || undefined;

  cachedApiKey = process.env.FIRST_RUN_NIA_KEY || "";
  return cachedApiKey || undefined;
}

export async function loadEnvFile(): Promise<void> {
  if (process.env.FIRST_RUN_NIA_KEY) return;

  // Try loading .env from the first-run package directory
  const envPaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), ".first-run.env"),
  ];

  for (const envPath of envPaths) {
    try {
      const content = await readFile(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^FIRST_RUN_NIA_KEY=(.+)$/);
        if (match) {
          const value = match[1].trim();
          if (value && !value.startsWith("your-")) {
            process.env.FIRST_RUN_NIA_KEY = value;
            cachedApiKey = value;
            return;
          }
        }
      }
    } catch {
      continue;
    }
  }
}

export function getNiaArgs(args: string[]): string[] {
  const apiKey = getNiaApiKey();
  if (apiKey) {
    return [...args, "--api-key", apiKey];
  }
  return args;
}
