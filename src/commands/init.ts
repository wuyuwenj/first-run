// T4: init command — maintainer sets up the project knowledge base

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { indexRepo, isRepoIndexed } from "../nia/index.js";
import { scanRepo } from "../scanner/files.js";
import type { RepoRequirements } from "../types.js";

function printScanSummary(scan: RepoRequirements): void {
  console.log(chalk.bold("\nWhat first-run found"));

  if (scan.packageManager) {
    const version = scan.packageManagerVersion ? `@${scan.packageManagerVersion}` : "";
    console.log(`- Package manager: ${chalk.cyan(`${scan.packageManager}${version}`)}`);
  }

  if (scan.node) {
    console.log(`- Node: ${chalk.cyan(scan.node)}`);
  }

  if (scan.python) {
    console.log(`- Python: ${chalk.cyan(scan.python)}`);
  }

  if (scan.frameworks?.length) {
    console.log(`- Frameworks: ${chalk.cyan(scan.frameworks.join(", "))}`);
  }

  if (scan.services?.length) {
    const services = scan.services.map((service) => {
      const details = [
        service.version ? `v${service.version}` : null,
        service.port ? `:${service.port}` : null,
        service.fromDocker ? "docker" : null,
      ].filter(Boolean);

      return details.length ? `${service.name} (${details.join(", ")})` : service.name;
    });

    console.log(`- Services: ${chalk.cyan(services.join(", "))}`);
  }

  if (scan.envVars?.length) {
    const required = scan.envVars.filter((envVar) => envVar.required).length;
    console.log(
      `- Environment variables: ${chalk.cyan(String(scan.envVars.length))} (${required} required)`,
    );
  }

  if (scan.dockerCompose || scan.dockerfile) {
    const dockerArtifacts = [
      scan.dockerCompose ? "docker-compose" : null,
      scan.dockerfile ? "Dockerfile" : null,
    ].filter(Boolean);

    console.log(`- Docker: ${chalk.cyan(dockerArtifacts.join(", "))}`);
  }
}

async function installSkill(repoPath: string, skillName: string): Promise<void> {
  const skillDir = join(repoPath, ".claude", "skills", skillName);
  const skillFile = join(skillDir, "SKILL.md");

  // Read the SKILL.md bundled with this package
  // import.meta.url is dist/src/commands/init.js, so go up 3 levels to package root
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const sourcePaths = [
    join(currentDir, "..", "..", "..", ".claude", "skills", skillName, "SKILL.md"),
    join(currentDir, "..", "..", ".claude", "skills", skillName, "SKILL.md"),
    join(currentDir, "..", ".claude", "skills", skillName, "SKILL.md"),
  ];

  let skillContent: string | null = null;
  for (const sourcePath of sourcePaths) {
    try {
      skillContent = await readFile(sourcePath, "utf-8");
      break;
    } catch {
      continue;
    }
  }

  if (!skillContent) {
    throw new Error(`Could not find bundled ${skillName}/SKILL.md. Try reinstalling first-run.`);
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillFile, skillContent);
}

async function installHookScript(repoPath: string, scriptName: string): Promise<void> {
  const hookDir = join(repoPath, ".claude", "hooks");
  const hookFile = join(hookDir, scriptName);

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const sourcePaths = [
    join(currentDir, "..", "..", "..", ".claude", "hooks", scriptName),
    join(currentDir, "..", "..", ".claude", "hooks", scriptName),
    join(currentDir, "..", ".claude", "hooks", scriptName),
  ];

  let hookContent: string | null = null;
  for (const sourcePath of sourcePaths) {
    try {
      hookContent = await readFile(sourcePath, "utf-8");
      break;
    } catch {
      continue;
    }
  }

  if (!hookContent) {
    throw new Error(`Could not find bundled ${scriptName}. Try reinstalling first-run.`);
  }

  await mkdir(hookDir, { recursive: true });
  await writeFile(hookFile, hookContent);
  await chmod(hookFile, 0o755);
}

function hasHookCommand(
  entries: Array<{ matcher?: string; hooks?: unknown[] }>,
  command: string,
): boolean {
  return entries.some((entry) =>
    entry.hooks?.some((h: unknown) =>
      typeof h === "object" && h !== null && (h as Record<string, unknown>).command === command,
    ),
  );
}

async function installHookSettings(repoPath: string): Promise<void> {
  const settingsFile = join(repoPath, ".claude", "settings.json");

  let settings: Record<string, unknown> = {};
  try {
    const raw = await readFile(settingsFile, "utf-8");
    settings = JSON.parse(raw);
  } catch {
    // No existing settings, start fresh
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  // PostToolUse: error detection on Bash
  const postToolUse = (hooks.PostToolUse ?? []) as Array<{ matcher?: string; hooks?: unknown[] }>;
  if (!hasHookCommand(postToolUse, "./.claude/hooks/check-errors.sh")) {
    postToolUse.push({
      matcher: "Bash",
      hooks: [{ type: "command", command: "./.claude/hooks/check-errors.sh", timeout: 10 }],
    });
  }
  hooks.PostToolUse = postToolUse;

  // PreToolUse: Nia search reminder on Read/Glob
  const preToolUse = (hooks.PreToolUse ?? []) as Array<{ matcher?: string; hooks?: unknown[] }>;
  if (!hasHookCommand(preToolUse, "./.claude/hooks/check-nia-search.sh")) {
    preToolUse.push({
      matcher: "Read|Glob",
      hooks: [{ type: "command", command: "./.claude/hooks/check-nia-search.sh", timeout: 5 }],
    });
  }
  hooks.PreToolUse = preToolUse;

  settings.hooks = hooks;

  await mkdir(join(repoPath, ".claude"), { recursive: true });
  await writeFile(settingsFile, JSON.stringify(settings, null, 2) + "\n");
}

export async function initCommand(repoPath: string): Promise<void> {
  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((error) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw error;
    });

  // Check if already indexed
  const alreadyIndexed = await isRepoIndexed(repoPath);
  let config;

  if (alreadyIndexed) {
    const configPath = join(repoPath, ".first-run.json");
    config = JSON.parse(await readFile(configPath, "utf-8"));
    console.log(chalk.dim("  Already indexed in Nia, skipping."));
  } else {
    const indexSpinner = ora("Indexing repository in Nia").start();
    config = await indexRepo(repoPath)
      .then((result) => {
        indexSpinner.succeed("Repository indexed in Nia");
        return result;
      })
      .catch((error) => {
        indexSpinner.fail("Failed to index repository");
        throw error;
      });
  }

  const scanSpinner = ora("Scanning repository requirements").start();
  const scan = await scanRepo(repoPath)
    .then((result) => {
      scanSpinner.succeed("Repository scanned");
      return result;
    })
    .catch((error) => {
      scanSpinner.fail("Failed to scan repository");
      throw error;
    });

  printScanSummary(scan);

  // Install skills into the repo
  const skillSpinner = ora("Installing skills").start();
  try {
    await installSkill(repoPath, "onboard");
    await installSkill(repoPath, "diagnose");
    await installSkill(repoPath, "upload-knowledge");
    skillSpinner.succeed("/onboard, /diagnose, and /uploadKnowledge skills installed");
  } catch (error) {
    skillSpinner.fail("Failed to install skills");
    throw error;
  }

  // Install hooks
  const hookSpinner = ora("Installing hooks").start();
  try {
    await installHookScript(repoPath, "check-errors.sh");
    await installHookScript(repoPath, "check-nia-search.sh");
    await installHookSettings(repoPath);
    hookSpinner.succeed("Hooks installed (error detection + Nia search reminder)");
  } catch (error) {
    hookSpinner.fail("Failed to install hooks");
    throw error;
  }

  console.log(chalk.bold("\nProject config"));
  console.log(`- Repo: ${chalk.cyan(config.repoName)}`);
  console.log(`- Source ID: ${chalk.cyan(config.niaSourceId ?? "unknown")}`);
  console.log(`- Config file: ${chalk.cyan(join(repoPath, ".first-run.json"))}`);
  console.log(`- Skills: ${chalk.cyan(join(repoPath, ".claude/skills/{onboard,diagnose,upload-knowledge}/SKILL.md"))}`);
  console.log(`- Hook: ${chalk.cyan(join(repoPath, ".claude/hooks/check-errors.sh"))}`);


  console.log(chalk.green("\n✓ first-run init completed."));

  console.log(chalk.bold("\nInstalled skills"));
  console.log(`  ${chalk.cyan("/onboard")}          — Guided repo setup: installs deps, configures env, starts services`);
  console.log(`  ${chalk.cyan("/diagnose")}         — Error diagnosis: searches community fixes, then investigates locally`);
  console.log(chalk.dim(`                       Auto-triggers when Claude hits an error — no need to type /diagnose.`));
  console.log(`  ${chalk.cyan("/uploadKnowledge")}  — Save tips, fixes, and gotchas to the Nia community knowledge base`);
  console.log(chalk.dim(`                       Share what you learned so the next developer benefits.`));

  console.log(chalk.bold("\nNext steps"));
  console.log(`  1. Open Claude Code in this repo:`);
  console.log(chalk.cyan(`     claude`));
  console.log(`  2. Type ${chalk.cyan("/onboard")} to start the guided setup`);
  console.log(`  3. If you hit an error, Claude will automatically diagnose it`);
  console.log(`     using community fixes — or type ${chalk.cyan("/diagnose")} to trigger it manually.`);
  console.log(`  4. Type ${chalk.cyan("/uploadKnowledge")} to share tips or fixes with the community`);
  console.log("");
  console.log(chalk.dim("Tip: Commit .claude/ to your repo so every contributor gets all skills automatically."));
}
