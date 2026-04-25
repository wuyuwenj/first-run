import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { RepoRequirements } from "../types.js";

export interface Contradiction {
  field: string;
  sources: { file: string; value: string }[];
  recommendation: string;
}

async function readFileIfExists(path: string): Promise<string | null> {
  try {
    await access(path);
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function detectLockfileContradictions(
  repoPath: string,
  requirements: RepoRequirements
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  const [hasPnpmLock, hasYarnLock, hasPackageLock, hasBunLock] = await Promise.all([
    readFileIfExists(join(repoPath, "pnpm-lock.yaml")).then((r) => r !== null),
    readFileIfExists(join(repoPath, "yarn.lock")).then((r) => r !== null),
    readFileIfExists(join(repoPath, "package-lock.json")).then((r) => r !== null),
    readFileIfExists(join(repoPath, "bun.lockb")).then((r) => r !== null),
  ]);

  const lockfileManager = hasPnpmLock
    ? "pnpm"
    : hasYarnLock
      ? "yarn"
      : hasBunLock
        ? "bun"
        : hasPackageLock
          ? "npm"
          : null;

  // Check packageManager field vs lockfile
  if (
    requirements.packageManager &&
    lockfileManager &&
    requirements.packageManager !== lockfileManager
  ) {
    contradictions.push({
      field: "packageManager",
      sources: [
        { file: "package.json (packageManager field)", value: requirements.packageManager },
        { file: `${lockfileManager} lockfile`, value: lockfileManager },
      ],
      recommendation: `package.json says ${requirements.packageManager} but ${lockfileManager} lockfile exists. Use ${requirements.packageManager} (packageManager field takes precedence).`,
    });
  }

  // Multiple lockfiles
  const lockfiles = [
    hasPnpmLock && "pnpm-lock.yaml",
    hasYarnLock && "yarn.lock",
    hasPackageLock && "package-lock.json",
    hasBunLock && "bun.lockb",
  ].filter(Boolean) as string[];

  if (lockfiles.length > 1) {
    contradictions.push({
      field: "packageManager",
      sources: lockfiles.map((f) => ({ file: f, value: "present" })),
      recommendation: `Multiple lockfiles found (${lockfiles.join(", ")}). This can cause conflicts. Use ${requirements.packageManager || lockfileManager || "one"} and remove the others.`,
    });
  }

  return contradictions;
}

async function detectReadmeContradictions(
  repoPath: string,
  requirements: RepoRequirements
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];
  const readme = await readFileIfExists(join(repoPath, "README.md"));
  if (!readme) return contradictions;

  const readmeLower = readme.toLowerCase();

  // Check if README mentions a different package manager
  if (requirements.packageManager) {
    const pmMentions: Record<string, boolean> = {
      npm: /npm install|npm run|npm start/i.test(readme),
      pnpm: /pnpm install|pnpm run|pnpm dev/i.test(readme),
      yarn: /yarn install|yarn run|yarn dev/i.test(readme),
      bun: /bun install|bun run|bun dev/i.test(readme),
    };

    for (const [pm, mentioned] of Object.entries(pmMentions)) {
      if (mentioned && pm !== requirements.packageManager) {
        contradictions.push({
          field: "packageManager",
          sources: [
            { file: "README.md", value: `mentions ${pm}` },
            { file: "package.json / lockfile", value: requirements.packageManager },
          ],
          recommendation: `README mentions "${pm}" commands but repo is configured for ${requirements.packageManager}. README may be outdated.`,
        });
        break; // one contradiction is enough
      }
    }
  }

  return contradictions;
}

async function detectCIContradictions(
  repoPath: string,
  requirements: RepoRequirements
): Promise<{ contradictions: Contradiction[]; ciNodeVersion?: string }> {
  const contradictions: Contradiction[] = [];
  let ciNodeVersion: string | undefined;

  // Try to read a CI workflow file
  const ciContent = await readFileIfExists(
    join(repoPath, ".github/workflows/ci.yml")
  ) || await readFileIfExists(
    join(repoPath, ".github/workflows/ci.yaml")
  ) || await readFileIfExists(
    join(repoPath, ".github/workflows/test.yml")
  ) || await readFileIfExists(
    join(repoPath, ".github/workflows/build.yml")
  );

  if (!ciContent) return { contradictions };

  // Extract node version from CI
  const nodeMatch = ciContent.match(/node-version:\s*['"]?(\d+)['"]?/);
  if (nodeMatch) {
    ciNodeVersion = nodeMatch[1];

    // Compare with package.json node version
    if (requirements.node) {
      const reqMajor = requirements.node.match(/(\d+)/)?.[1];
      if (reqMajor && reqMajor !== ciNodeVersion) {
        contradictions.push({
          field: "node",
          sources: [
            { file: "package.json (engines.node)", value: requirements.node },
            { file: "CI workflow", value: `Node ${ciNodeVersion}` },
          ],
          recommendation: `CI uses Node ${ciNodeVersion} but package.json requires ${requirements.node}. CI version is likely the tested one.`,
        });
      }
    }
  }

  return { contradictions, ciNodeVersion };
}

export async function resolveRequirements(
  repoPath: string,
  rawScan: RepoRequirements
): Promise<{ requirements: RepoRequirements; contradictions: Contradiction[] }> {
  const requirements = { ...rawScan };
  const allContradictions: Contradiction[] = [];

  // Run all contradiction checks in parallel
  const [lockfileResults, readmeResults, ciResults] = await Promise.all([
    detectLockfileContradictions(repoPath, requirements),
    detectReadmeContradictions(repoPath, requirements),
    detectCIContradictions(repoPath, requirements),
  ]);

  allContradictions.push(...lockfileResults, ...readmeResults, ...ciResults.contradictions);

  // If CI has a node version and we don't, use it
  if (!requirements.node && ciResults.ciNodeVersion) {
    requirements.node = `>=${ciResults.ciNodeVersion}`;
  }

  return { requirements, contradictions: allContradictions };
}
