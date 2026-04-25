// T3: Runner — execute setup steps interactively

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { execaCommand } from "execa";
import ora from "ora";

import type { SetupPlan, SetupStep, KnownFix } from "../types.js";
import { searchForFixes } from "../nia/search.js";
import { saveFix } from "../nia/save.js";

export async function runPlan(plan: SetupPlan): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    if (plan.warnings.length > 0) {
      console.log(chalk.yellow("Warnings:"));
      for (const warning of plan.warnings) {
        console.log(chalk.yellow(`- ${warning}`));
      }
      console.log("");
    }

    for (const step of plan.steps) {
      printStep(step);
      const decision = (await rl.question(chalk.cyan("Run? [Y/n/skip] "))).trim().toLowerCase();

      if (decision === "skip" || decision === "s") {
        step.status = "skipped";
        console.log(chalk.yellow(`Skipped step ${step.id}.`));
        console.log("");
        continue;
      }

      if (decision === "n" || decision === "no" || decision === "q" || decision === "quit") {
        console.log(chalk.yellow("Stopping plan execution."));
        break;
      }

      step.status = "running";
      const result = await runStep(step);

      if (!result.success) {
        step.status = "failed";
        console.log(chalk.red(result.output || `Step ${step.id} failed.`));

        const resolved = await attemptFixFlow(step, result.output, rl);
        if (!resolved) {
          const shouldContinue = (await rl.question(chalk.cyan("Continue to the next step? [y/N] ")))
            .trim()
            .toLowerCase();

          console.log("");
          if (shouldContinue !== "y" && shouldContinue !== "yes") {
            break;
          }
        }

        continue;
      }

      step.status = "success";
      console.log(chalk.green(`Step ${step.id} completed.`));
      console.log("");
    }
  } finally {
    rl.close();
  }
}

export async function runStep(step: SetupStep): Promise<{ success: boolean; output: string }> {
  const spinner = ora(`Running step ${step.id}: ${step.name}`).start();

  try {
    const result = await execaCommand(step.command, {
      shell: true,
      cwd: process.cwd(),
      all: true,
    });

    const combinedOutput = result.all ?? [result.stdout, result.stderr].filter(Boolean).join("\n");

    if (step.check) {
      spinner.text = `Verifying step ${step.id}: ${step.name}`;

      try {
        const checkResult = await execaCommand(step.check, {
          shell: true,
          cwd: process.cwd(),
          all: true,
        });

        const checkOutput = checkResult.all ?? [checkResult.stdout, checkResult.stderr].filter(Boolean).join("\n");
        spinner.succeed(`Verified step ${step.id}: ${step.name}`);
        return { success: true, output: [combinedOutput, checkOutput].filter(Boolean).join("\n") };
      } catch (error) {
        const failureOutput = formatExecaError(error);
        spinner.fail(`Verification failed for step ${step.id}: ${step.name}`);
        return { success: false, output: [combinedOutput, failureOutput].filter(Boolean).join("\n") };
      }
    }

    spinner.succeed(`Completed step ${step.id}: ${step.name}`);
    return { success: true, output: combinedOutput };
  } catch (error) {
    spinner.fail(`Failed step ${step.id}: ${step.name}`);
    return { success: false, output: formatExecaError(error) };
  }
}

async function attemptFixFlow(
  step: SetupStep,
  errorOutput: string,
  rl: ReturnType<typeof createInterface>
): Promise<boolean> {
  const fixes = await findFixes(errorOutput);

  if (fixes.length > 0) {
    console.log(chalk.yellow("Possible fixes:"));
    fixes.slice(0, 3).forEach((fix, index) => {
      const summary = fix.fix || fix.errorPattern;
      const command = fix.command ? chalk.gray(` (${fix.command})`) : "";
      console.log(chalk.yellow(`${index + 1}. ${summary}${command}`));
    });

    const answer = (await rl.question(chalk.cyan("Run one of these fixes? [1-3/N] "))).trim().toLowerCase();
    const selectedIndex = Number.parseInt(answer, 10) - 1;
    const selectedFix = Number.isInteger(selectedIndex) ? fixes[selectedIndex] : undefined;

    if (selectedFix?.command) {
      const spinner = ora(`Running fix for step ${step.id}`).start();

      try {
        await execaCommand(selectedFix.command, {
          shell: true,
          cwd: process.cwd(),
          all: true,
        });
        spinner.succeed("Applied selected fix.");

        const rerun = await runStep(step);
        if (rerun.success) {
          step.status = "success";
          console.log(chalk.green(`Step ${step.id} passed after applying the fix.`));
          console.log("");
          return true;
        }

        console.log(chalk.red(rerun.output || "The step still failed after applying the fix."));
      } catch (error) {
        spinner.fail("Selected fix failed.");
        console.log(chalk.red(formatExecaError(error)));
      }
    }
  }

  const shouldSave = (await rl.question(chalk.cyan("Save a note about this issue for later? [y/N] ")))
    .trim()
    .toLowerCase();

  if (shouldSave === "y" || shouldSave === "yes") {
    await promptToSaveFix(step, errorOutput, rl);
  }

  return false;
}

async function findFixes(errorOutput: string): Promise<KnownFix[]> {
  try {
    return await searchForFixes(errorOutput);
  } catch {
    return [];
  }
}

async function promptToSaveFix(
  step: SetupStep,
  errorOutput: string,
  rl: ReturnType<typeof createInterface>
): Promise<void> {
  const fixDescription = (await rl.question(chalk.cyan("What fixed it? "))).trim();
  if (!fixDescription) {
    return;
  }

  const fixCommand = (await rl.question(chalk.cyan("Command used (optional): "))).trim();

  try {
    await saveFix({
      errorPattern: summarizeError(errorOutput),
      fix: fixDescription,
      command: fixCommand || undefined,
      stepName: step.name,
      createdAt: new Date().toISOString(),
    });
    console.log(chalk.green("Saved fix note."));
  } catch {
    console.log(chalk.yellow("Could not save the fix note yet."));
  }
}

function printStep(step: SetupStep): void {
  console.log(chalk.bold(`Step ${step.id}: ${step.name}`));
  console.log(chalk.gray(step.why));
  console.log(chalk.white(`$ ${step.command}`));
}

function formatExecaError(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string;
      shortMessage?: string;
      stdout?: string;
      stderr?: string;
      all?: string;
    };

    return [maybeError.shortMessage, maybeError.message, maybeError.all, maybeError.stdout, maybeError.stderr]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("\n");
  }

  return String(error);
}

function summarizeError(errorOutput: string): string {
  const firstLine = errorOutput
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "Unknown setup error";
}
