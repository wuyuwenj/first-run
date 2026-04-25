#!/usr/bin/env node

// T4: CLI entry point — wires all commands together

import { Command } from "commander";
import chalk from "chalk";
import { askCommand } from "../src/commands/ask.js";
import { initCommand } from "../src/commands/init.js";
import { learnCommand } from "../src/commands/learn.js";
import { saveKnowledgeCommand } from "../src/commands/save-knowledge.js";

const program = new Command();

program
  .name("first-run")
  .description("Get any repo running locally. Community-powered setup that gets smarter over time.")
  .version("0.1.0")
  .showHelpAfterError();

// first-run init — maintainer indexes repo to Nia
program
  .command("init")
  .description("Index this repo and set up the community knowledge base")
  .action(async () => {
    await initCommand(process.cwd());
  });

// first-run (default) — install /onboard skill into this repo
program
  .command("install", { isDefault: true })
  .description("Install the /onboard skill into this repo so contributors can use it in Claude Code")
  .action(async () => {
    await initCommand(process.cwd());
  });

// first-run ask <question> — query the knowledge base
program
  .command("ask <question>")
  .description("Ask a question about this repo")
  .action(async (question: string) => {
    await askCommand(question);
  });

// first-run learn — save a fix or tip to the knowledge base
program
  .command("learn")
  .description("Save a fix or tip for future contributors")
  .option("-e, --error <error>", "The error message")
  .option("-f, --fix <fix>", "The fix/solution")
  .action(async (opts: { error?: string; fix?: string }) => {
    await learnCommand(opts.error, opts.fix);
  });

// first-run save — save knowledge to the repo's Nia source
program
  .command("save")
  .description("Save knowledge (tips, gotchas, fixes) to the repo's Nia source")
  .option("-t, --title <title>", "Title for the knowledge entry")
  .option("-c, --content <content>", "Content of the knowledge entry")
  .option("--category <category>", "Category: fix, tip, gotcha, env, prereq", "tip")
  .action(async (opts: { title?: string; content?: string; category?: string }) => {
    await saveKnowledgeCommand(process.cwd(), opts.title, opts.content, opts.category);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(message));
  process.exitCode = 1;
}
