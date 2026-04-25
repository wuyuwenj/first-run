// T2: Nia save — save new fixes/knowledge to the Nia knowledge base

import type { KnownFix } from "../types.js";

export async function saveFix(fix: KnownFix): Promise<void> {
  // TODO T2: Implement
  // 1. Format the fix as a structured context
  // 2. Run `nia contexts save` with title, content, tags
  // 3. Include metadata: OS, arch, tool versions, step name
  throw new Error("Not implemented");
}

export async function saveKnowledge(title: string, content: string, tags?: string[]): Promise<void> {
  // TODO T2: Implement
  // 1. Run `nia contexts save --title <title> --content <content> --tags <tags>`
  throw new Error("Not implemented");
}
