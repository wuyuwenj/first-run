// T4: ask command — query the knowledge base

import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { searchRepo } from "../nia/search.js";

export async function askCommand(question: string): Promise<void> {
  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((error) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw error;
    });

  const searchSpinner = ora(`Searching knowledge base for: ${question}`).start();
  const answer = await searchRepo(question)
    .then((result) => {
      searchSpinner.succeed("Knowledge base search complete");
      return result;
    })
    .catch((error) => {
      searchSpinner.fail("Knowledge base search failed");
      throw error;
    });

  console.log(chalk.bold("\nQuestion"));
  console.log(question);

  console.log(chalk.bold("\nAnswer"));
  if (answer) {
    console.log(answer);
  } else {
    console.log(chalk.yellow("No answer found in the knowledge base yet."));
  }
}
