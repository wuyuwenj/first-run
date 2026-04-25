// T3: Planner — compare repo requirements vs machine profile, generate setup plan

import type { RepoRequirements, MachineProfile, SetupPlan, SetupStep } from "../types.js";
import type { Contradiction } from "../scanner/requirements.js";

export function generatePlan(
  requirements: RepoRequirements,
  machine: MachineProfile,
  contradictions: Contradiction[]
): SetupPlan {
  // TODO T3: Implement
  // 1. For each requirement, check if machine satisfies it
  // 2. Generate install/upgrade commands for missing tools
  //    - Use brew on macOS, apt on Linux
  //    - Respect user's existing package manager
  // 3. Generate env setup steps (cp .env.example .env)
  // 4. Generate service start steps (docker compose up or brew services start)
  // 5. Generate dependency install step (pnpm install, pip install, etc.)
  // 6. Generate migration/build steps from package.json scripts
  // 7. Add verification step (run dev server, check port)
  // 8. Add warnings from contradictions
  throw new Error("Not implemented");
}

export function getInstallCommand(
  tool: string,
  version: string,
  os: "macos" | "linux" | "windows"
): string {
  // TODO T3: Return the right install command per OS
  // e.g. ("node", "20", "macos") → "brew install node@20"
  // e.g. ("pnpm", "9", "macos") → "corepack enable && corepack prepare pnpm@9 --activate"
  throw new Error("Not implemented");
}
