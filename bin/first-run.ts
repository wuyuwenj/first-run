#!/usr/bin/env node

// T4: CLI entry point — wires all commands together

import { Command } from "commander";

const program = new Command();

program
  .name("first-run")
  .description("Get any repo running locally. Community-powered setup that gets smarter over time.")
  .version("0.1.0");

// first-run init — maintainer indexes repo to Nia
program
  .command("init")
  .description("Index this repo and set up the community knowledge base")
  .action(async () => {
    // TODO T4: Wire to commands/init.ts
    console.log("TODO: init");
  });

// first-run (default) — contributor setup flow
program
  .command("setup", { isDefault: true })
  .description("Scan repo, profile your machine, and get a personalized setup plan")
  .action(async () => {
    // TODO T4: Wire to commands/setup.ts
    console.log("TODO: setup");
  });

// first-run ask <question> — query the knowledge base
program
  .command("ask <question>")
  .description("Ask a question about this repo")
  .action(async (question: string) => {
    // TODO T4: Wire to commands/ask.ts
    console.log("TODO: ask", question);
  });

// first-run learn — save a fix or tip to the knowledge base
program
  .command("learn")
  .description("Save a fix or tip for future contributors")
  .option("-e, --error <error>", "The error message")
  .option("-f, --fix <fix>", "The fix/solution")
  .action(async (opts: { error?: string; fix?: string }) => {
    // TODO T4: Wire to commands/learn.ts
    console.log("TODO: learn", opts);
  });

program.parse();
