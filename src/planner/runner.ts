// T3: Runner — execute setup steps interactively

import type { SetupPlan, SetupStep, KnownFix } from "../types.js";

export async function runPlan(plan: SetupPlan): Promise<void> {
  // TODO T3: Implement
  // For each step:
  // 1. Display step name, command, and why
  // 2. Ask user: Run? [Y/n/skip]
  // 3. If yes, execute command via execa
  // 4. If success, mark step as success, move to next
  // 5. If error:
  //    a. Capture error output
  //    b. Call searchForFixes(errorOutput) from nia/search
  //    c. If fixes found, display them ranked
  //    d. If user picks a fix, run it
  //    e. If no fix / new error, offer to save after user resolves it
  // 6. If check command exists, run it to verify
  throw new Error("Not implemented");
}

export async function runStep(step: SetupStep): Promise<{ success: boolean; output: string }> {
  // TODO T3: Execute a single step, return result
  throw new Error("Not implemented");
}
