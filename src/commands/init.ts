// T4: init command — maintainer sets up the project knowledge base

import { access } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { indexRepo } from "../nia/index.js";
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

export async function initCommand(repoPath: string): Promise<void> {
  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((error) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw error;
    });

  const indexSpinner = ora("Indexing repository in Nia").start();
  const config = await indexRepo(repoPath)
    .then((result) => {
      indexSpinner.succeed("Repository indexed");
      return result;
    })
    .catch((error) => {
      indexSpinner.fail("Failed to index repository");
      throw error;
    });

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

  const onboardSkillPath = join(repoPath, ".claude/skills/onboard");
  let hasOnboardSkill = false;
  try {
    await access(onboardSkillPath);
    hasOnboardSkill = true;
  } catch {
    hasOnboardSkill = false;
  }

  console.log(chalk.bold("\nProject config"));
  console.log(`- Repo: ${chalk.cyan(config.repoName)}`);
  console.log(`- Source ID: ${chalk.cyan(config.niaSourceId ?? "unknown")}`);
  console.log(`- Config file: ${chalk.cyan(join(repoPath, ".first-run.json"))}`);

  if (!hasOnboardSkill) {
    console.log(
      chalk.yellow(
        "\nTip: add .claude/skills/onboard/ to this repo so maintainers can keep setup guidance close to the codebase.",
      ),
    );
  }

  console.log(chalk.green("\nfirst-run init completed."));
}
