// === Shared types — all 4 sessions depend on these ===

// --- Scanner output ---

export interface RepoRequirements {
  node?: string; // semver range e.g. ">=20"
  python?: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  packageManagerVersion?: string;
  services?: Service[];
  envVars?: EnvVar[];
  scripts?: Record<string, string>; // e.g. { dev: "next dev", build: "next build" }
  frameworks?: string[]; // e.g. ["next", "prisma", "tailwind"]
  dockerCompose?: boolean;
  dockerfile?: boolean;
}

export interface Service {
  name: string; // "postgres", "redis", "mysql"
  version?: string;
  port?: number;
  fromDocker?: boolean; // found in docker-compose
}

export interface EnvVar {
  key: string;
  example?: string; // value from .env.example
  required: boolean;
  isSecret: boolean; // looks like a key/token/password
}

// --- Machine profiler output ---

export interface MachineProfile {
  os: "macos" | "linux" | "windows";
  arch: "arm64" | "x64";
  tools: Record<string, string | null>; // tool name → version or null if missing
  runningServices: Record<string, boolean>; // service name → running?
}

// --- Planner output ---

export interface SetupPlan {
  steps: SetupStep[];
  warnings: string[]; // e.g. "README says npm but repo uses pnpm"
}

export interface SetupStep {
  id: number;
  name: string;
  command: string;
  why: string;
  check?: string; // command to verify success
  status: "pending" | "running" | "success" | "failed" | "skipped";
}

// --- Nia knowledge ---

export interface KnownFix {
  id?: string;
  errorPattern: string; // the error message or pattern
  os?: string;
  arch?: string;
  toolVersions?: Record<string, string>; // context when error occurred
  fix: string; // description of the fix
  command?: string; // command to run
  contributor?: string;
  stepName?: string; // which setup step it happened on
  createdAt?: string;
}

// --- Project config (stored in .first-run.json) ---

export interface ProjectConfig {
  niaSourceId?: string;
  repoName: string;
  repoUrl?: string;
  createdAt: string;
  lastIndexed?: string;
}
