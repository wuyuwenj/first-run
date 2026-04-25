// T2: Nia auto-install — check if Nia CLI is installed, install if needed

export async function ensureNiaInstalled(): Promise<void> {
  // TODO T2: Implement
  // 1. Check if `nia` command exists (execa which nia or nia --version)
  // 2. If not installed, prompt user and run `npm i -g @nozomioai/nia`
  // 3. Check if authenticated (nia auth status or similar)
  // 4. If not authenticated, run `nia auth login` and guide user
  throw new Error("Not implemented");
}

export async function isNiaInstalled(): Promise<boolean> {
  // TODO T2: Check if nia command exists
  throw new Error("Not implemented");
}

export async function isNiaAuthenticated(): Promise<boolean> {
  // TODO T2: Check if nia is authenticated
  throw new Error("Not implemented");
}
