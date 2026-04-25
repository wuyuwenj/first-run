// save-knowledge command — save tips, gotchas, and fixes to Nia contexts

import { createInterface } from "node:readline/promises";
import chalk from "chalk";
import ora from "ora";
import { ensureNiaInstalled } from "../nia/install.js";
import { saveKnowledge } from "../nia/save.js";

const VALID_CATEGORIES = ["fix", "tip", "gotcha", "env", "prereq"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function isValidCategory(value: string): value is Category {
  return VALID_CATEGORIES.includes(value as Category);
}

async function promptForInputs(
  title: string | undefined,
  content: string | undefined,
  category: string | undefined,
): Promise<{ title: string; content: string; category: Category }> {
  if (title?.trim() && content?.trim() && category && isValidCategory(category)) {
    return { title: title.trim(), content: content.trim(), category };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Missing --title, --content, or --category and no interactive terminal is available.");
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const finalTitle = title?.trim() || (await readline.question("Title: ")).trim();
    if (!finalTitle) throw new Error("Title is required.");

    const finalContent = content?.trim() || (await readline.question("Content: ")).trim();
    if (!finalContent) throw new Error("Content is required.");

    let finalCategory: Category;
    if (category && isValidCategory(category)) {
      finalCategory = category;
    } else {
      console.log(chalk.dim(`Categories: ${VALID_CATEGORIES.join(", ")}`));
      const input = (await readline.question("Category [tip]: ")).trim().toLowerCase() || "tip";
      if (!isValidCategory(input)) {
        throw new Error(`Invalid category: ${input}. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
      }
      finalCategory = input;
    }

    return { title: finalTitle, content: finalContent, category: finalCategory };
  } finally {
    readline.close();
  }
}

export async function saveKnowledgeCommand(
  _repoPath: string,
  title?: string,
  content?: string,
  category?: string,
): Promise<void> {
  const inputs = await promptForInputs(title, content, category);

  const niaSpinner = ora("Checking Nia CLI").start();
  await ensureNiaInstalled()
    .then(() => niaSpinner.succeed("Nia CLI ready"))
    .catch((error) => {
      niaSpinner.fail("Failed to prepare Nia CLI");
      throw error;
    });

  const saveSpinner = ora("Saving knowledge to Nia").start();
  await saveKnowledge(inputs.title, inputs.content, inputs.category)
    .then(() => {
      saveSpinner.succeed("Knowledge saved");
    })
    .catch((error) => {
      saveSpinner.fail("Failed to save knowledge");
      throw error;
    });

  console.log(chalk.green("\nSaved to the knowledge base."));
  console.log(chalk.dim(`Title: ${inputs.title}`));
  console.log(chalk.dim(`Category: ${inputs.category}`));
}
