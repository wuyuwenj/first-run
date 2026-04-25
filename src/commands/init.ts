// T4: init command — maintainer sets up the project knowledge base

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

async function installOnboardSkill(repoPath: string): Promise<void> {
  const skillDir = join(repoPath, ".claude", "skills", "onboard");
  const skillFile = join(skillDir, "SKILL.md");

  // Read the SKILL.md bundled with this package
  // import.meta.url is dist/src/commands/init.js, so go up 3 levels to package root
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const sourcePaths = [
    join(currentDir, "..", "..", "..", ".claude", "skills", "onboard", "SKILL.md"),
    join(currentDir, "..", "..", ".claude", "skills", "onboard", "SKILL.md"),
    join(currentDir, "..", ".claude", "skills", "onboard", "SKILL.md"),
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
    throw new Error("Could not find bundled SKILL.md. Try reinstalling first-run.");
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillFile, skillContent);
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

  // Install /onboard skill into the repo
  const skillSpinner = ora("Installing /onboard skill").start();
  try {
    await installOnboardSkill(repoPath);
    skillSpinner.succeed("/onboard skill installed");
  } catch (error) {
    skillSpinner.fail("Failed to install /onboard skill");
    throw error;
  }

  console.log(chalk.bold("\nProject config"));
  console.log(`- Repo: ${chalk.cyan(config.repoName)}`);
  console.log(`- Source ID: ${chalk.cyan(config.niaSourceId ?? "unknown")}`);
  console.log(`- Config file: ${chalk.cyan(join(repoPath, ".first-run.json"))}`);
  console.log(`- Skill: ${chalk.cyan(join(repoPath, ".claude/skills/onboard/SKILL.md"))}`);

  console.log(chalk.green("\n✓ first-run init completed."));

  console.log(chalk.bold("\nNext steps"));
  console.log(`  1. Open Claude Code in this repo:`);
  console.log(chalk.cyan(`     claude`));
  console.log(`  2. Type ${chalk.cyan("/onboard")} to start the guided setup`);
  console.log(`  3. Claude will scan your machine, install dependencies,`);
  console.log(`     set up your .env, and get the project running.`);
  console.log("");
  console.log(chalk.dim("Tip: Commit .claude/skills/onboard/ to your repo so every contributor gets /onboard automatically."));
}
