// T1: Scanner — reads repo files and extracts structured data
// Reads: package.json, Dockerfile, docker-compose.yml, .env.example,
//        Makefile, pyproject.toml, .nvmrc, .node-version, .tool-versions

import type { RepoRequirements, Service, EnvVar } from "../types.js";

export async function scanRepo(repoPath: string): Promise<RepoRequirements> {
  // TODO T1: Implement
  // 1. Read package.json → extract node version, package manager, scripts, deps
  // 2. Read docker-compose.yml → extract services (postgres, redis, etc.)
  // 3. Read .env.example → extract env vars, flag secrets
  // 4. Read Dockerfile → detect base image, runtime
  // 5. Read pyproject.toml → python version, deps
  // 6. Read .nvmrc / .node-version / .tool-versions → pinned versions
  // 7. Read CI configs (.github/workflows/) → extract real setup commands
  throw new Error("Not implemented");
}
