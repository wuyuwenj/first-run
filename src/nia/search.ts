// T2: Nia search — search the knowledge base for setup info or error fixes

import type { KnownFix } from "../types.js";

export async function searchForFixes(errorMessage: string): Promise<KnownFix[]> {
  // TODO T2: Implement
  // 1. Run `nia search` or `nia contexts search` with the error message
  // 2. Parse results into KnownFix[]
  // 3. Rank by relevance
  throw new Error("Not implemented");
}

export async function searchRepo(query: string): Promise<string> {
  // TODO T2: Implement
  // 1. Run `nia search <query>` scoped to the project
  // 2. Return the cited answer
  throw new Error("Not implemented");
}
