// T4: learn command — save a fix or tip to the knowledge base

import { createInterface } from "node:readline/promises";
import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { saveFix } from "../nia/save.js";
import { profileMachine } from "../profiler/machine.js";

async function promptForMissingInputs(
  error: string | undefined,
  fix: string | undefined,
): Promise<{ errorPattern: string; fixText: string }> {
  if (error?.trim() && fix?.trim()) {
    return { errorPattern: error.trim(), fixText: fix.trim() };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Missing --error or --fix values and no interactive terminal is available.");
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const errorPattern = error?.trim() || (await readline.question("Error or problem: ")).trim();
    const fixText = fix?.trim() || (await readline.question("Fix or tip: ")).trim();

    if (!errorPattern || !fixText) {
      throw new Error("Both an error and a fix are required.");
    }

    return { errorPattern, fixText };
  } finally {
    readline.close();
  }
}

export async function learnCommand(error?: string, fix?: string): Promise<void> {
  const { errorPattern, fixText } = await promptForMissingInputs(error, fix);

  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((niaError) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw niaError;
    });

  const profileSpinner = ora("Capturing machine context").start();
  const machine = await profileMachine()
    .then((result) => {
      profileSpinner.succeed("Machine profile captured");
      return result;
    })
    .catch((profileError) => {
      profileSpinner.fail("Failed to capture machine profile");
      throw profileError;
    });

  const toolVersions = Object.fromEntries(
    Object.entries(machine.tools).filter((entry): entry is [string, string] => entry[1] !== null),
  );

  const saveSpinner = ora("Saving fix to Nia").start();
  await saveFix({
    errorPattern,
    fix: fixText,
    os: machine.os,
    arch: machine.arch,
    toolVersions,
  })
    .then(() => saveSpinner.succeed("Fix saved"))
    .catch((saveError) => {
      saveSpinner.fail("Failed to save fix");
      throw saveError;
    });

  console.log(chalk.green("\nSaved fix to the knowledge base."));
  console.log(chalk.dim(`Error: ${errorPattern}`));
  console.log(chalk.dim(`Fix: ${fixText}`));
}
