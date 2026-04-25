# /onboard — First Run Setup Skill

Get this repo running locally with a personalized setup plan.

## When to use
- User types `/onboard`
- User asks how to set up or run this project
- User is new to the repo and wants to get started

## What to do

1. Check if `first-run` CLI is available. If not, run: `npx first-run`
2. Run `npx first-run setup` in the repo root
3. Guide the user through each setup step
4. If any step fails, search for community fixes via `npx first-run ask "<error>"`
5. If the user solves a new error, suggest saving it: `npx first-run learn`

## Commands available
- `npx first-run init` — Index this repo (maintainer only, first time)
- `npx first-run` — Get personalized setup plan
- `npx first-run ask "<question>"` — Ask about this repo
- `npx first-run learn` — Save a fix for future contributors
