// T1: Machine Profiler — detects what's installed on the user's machine

import type { MachineProfile } from "../types.js";

export async function profileMachine(): Promise<MachineProfile> {
  // TODO T1: Implement
  // 1. Detect OS (process.platform) and arch (process.arch)
  // 2. Check tool versions: node, npm, pnpm, yarn, bun, python, pip, docker, docker-compose
  // 3. Check running services: postgres, redis, mysql (via port check or process list)
  // Return MachineProfile
  throw new Error("Not implemented");
}

export async function getToolVersion(tool: string): Promise<string | null> {
  // TODO T1: Run `tool --version`, parse output, return version string or null
  throw new Error("Not implemented");
}

export async function isServiceRunning(service: string): Promise<boolean> {
  // TODO T1: Check if service is running (port check or `docker ps` or `brew services list`)
  throw new Error("Not implemented");
}
