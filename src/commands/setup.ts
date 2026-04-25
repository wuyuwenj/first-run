// T4: setup command — contributor gets personalized setup plan

import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { generatePlan } from "../planner/diff.js";
import { runPlan } from "../planner/runner.js";
import { profileMachine } from "../profiler/machine.js";
import { scanRepo } from "../scanner/files.js";
import { resolveRequirements } from "../scanner/requirements.js";
import type { MachineProfile, RepoRequirements, SetupPlan } from "../types.js";

function formatTool(version: string | null | undefined): string {
  return version ? chalk.green(version) : chalk.red("missing");
}

function printRepoRequirements(requirements: RepoRequirements): void {
  console.log(chalk.bold("\nRepo requirements"));

  if (requirements.node) {
    console.log(`- Node: ${chalk.cyan(requirements.node)}`);
  }

  if (requirements.python) {
    console.log(`- Python: ${chalk.cyan(requirements.python)}`);
  }

  if (requirements.packageManager) {
    const version = requirements.packageManagerVersion ? `@${requirements.packageManagerVersion}` : "";
    console.log(`- Package manager: ${chalk.cyan(`${requirements.packageManager}${version}`)}`);
  }

  if (requirements.frameworks?.length) {
    console.log(`- Frameworks: ${chalk.cyan(requirements.frameworks.join(", "))}`);
  }

  if (requirements.services?.length) {
    console.log(`- Services: ${chalk.cyan(requirements.services.map((service) => service.name).join(", "))}`);
  }

  if (requirements.envVars?.length) {
    const required = requirements.envVars.filter((envVar) => envVar.required).length;
    console.log(
      `- Environment variables: ${chalk.cyan(String(requirements.envVars.length))} (${required} required)`,
    );
  }
}

function printMachineProfile(machine: MachineProfile): void {
  console.log(chalk.bold("\nYour machine"));
  console.log(`- OS: ${chalk.cyan(machine.os)} (${chalk.cyan(machine.arch)})`);
  console.log(`- node: ${formatTool(machine.tools.node)}`);
  console.log(`- npm: ${formatTool(machine.tools.npm)}`);
  console.log(`- pnpm: ${formatTool(machine.tools.pnpm)}`);
  console.log(`- yarn: ${formatTool(machine.tools.yarn)}`);
  console.log(`- bun: ${formatTool(machine.tools.bun)}`);
  console.log(`- python: ${formatTool(machine.tools.python)}`);
  console.log(`- pip: ${formatTool(machine.tools.pip)}`);
  console.log(`- docker: ${formatTool(machine.tools.docker)}`);
  console.log(`- docker-compose: ${formatTool(machine.tools["docker-compose"])}`);

  const runningServices = Object.entries(machine.runningServices)
    .filter(([, running]) => running)
    .map(([service]) => service);

  console.log(
    `- Running services: ${
      runningServices.length ? chalk.green(runningServices.join(", ")) : chalk.yellow("none detected")
    }`,
  );
}

function printPlan(plan: SetupPlan): void {
  console.log(chalk.bold("\nSetup plan"));

  if (plan.warnings.length) {
    console.log(chalk.yellow("Warnings"));
    for (const warning of plan.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (!plan.steps.length) {
    console.log(chalk.green("- No setup steps needed."));
    return;
  }

  for (const step of plan.steps) {
    console.log(`${chalk.cyan(String(step.id))}. ${step.name}`);
    console.log(`   ${chalk.dim(step.command)}`);
    console.log(`   ${step.why}`);
  }
}

export async function setupCommand(repoPath: string): Promise<void> {
  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((error) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw error;
    });

  const scanSpinner = ora("Scanning repository").start();
  const rawScan = await scanRepo(repoPath)
    .then((result) => {
      scanSpinner.succeed("Repository scanned");
      return result;
    })
    .catch((error) => {
      scanSpinner.fail("Failed to scan repository");
      throw error;
    });

  const resolveSpinner = ora("Resolving setup requirements").start();
  const { requirements, contradictions } = await resolveRequirements(repoPath, rawScan)
    .then((result) => {
      resolveSpinner.succeed("Requirements resolved");
      return result;
    })
    .catch((error) => {
      resolveSpinner.fail("Failed to resolve setup requirements");
      throw error;
    });

  const profileSpinner = ora("Profiling your machine").start();
  const machine = await profileMachine()
    .then((result) => {
      profileSpinner.succeed("Machine profile captured");
      return result;
    })
    .catch((error) => {
      profileSpinner.fail("Failed to profile your machine");
      throw error;
    });

  printRepoRequirements(requirements);
  printMachineProfile(machine);

  if (contradictions.length) {
    console.log(chalk.bold("\nRepo contradictions"));
    for (const contradiction of contradictions) {
      const sources = contradiction.sources
        .map((source) => `${source.file}: ${source.value}`)
        .join(" | ");
      console.log(`- ${chalk.yellow(contradiction.field)}: ${sources}`);
      console.log(`  ${chalk.dim(contradiction.recommendation)}`);
    }
  }

  const planSpinner = ora("Generating setup plan").start();
  const plan = await Promise.resolve(generatePlan(requirements, machine, contradictions))
    .then((result) => {
      planSpinner.succeed("Setup plan generated");
      return result;
    })
    .catch((error) => {
      planSpinner.fail("Failed to generate setup plan");
      throw error;
    });

  printPlan(plan);

  console.log("");
  await runPlan(plan);
}
