// T2: Nia auto-install — check if Nia CLI is installed, install if needed

import { execa } from "execa";

export async function ensureNiaInstalled(): Promise<void> {
  const installed = await isNiaInstalled();
  if (!installed) {
    console.log("Nia CLI not found. Installing @nozomioai/nia globally...");
    await execa("npm", ["i", "-g", "@nozomioai/nia"], { stdio: "inherit" });
  }

  const authenticated = await isNiaAuthenticated();
  if (!authenticated) {
    console.log("Nia CLI is not authenticated. Running nia auth login...");
    await execa("nia", ["auth", "login"], { stdio: "inherit" });
  }
}

export async function isNiaInstalled(): Promise<boolean> {
  try {
    await execa("nia", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function isNiaAuthenticated(): Promise<boolean> {
  try {
    await execa("nia", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}
