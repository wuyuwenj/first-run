# first-run

Get any repo running locally. Community-powered setup that gets smarter over time.

Every tip, every fix, every gotcha that any developer hits — it stays in the knowledge base. So the first person to set up this repo might take an hour. The tenth person? Maybe five minutes. Because they're not starting from scratch — they're building on what everyone before them already figured out.

`first-run` installs Claude Code skills and hooks into your project so that contributors can type `/onboard` and get guided through setup — with errors automatically diagnosed and fixes saved to a shared knowledge base powered by [Nia](https://trynia.ai).

## Install locally (for development)

```bash
git clone https://github.com/wuyuwenj/first-run.git
cd first-run
npm install
npm run build
npm link
```

This makes the `first-run` command available globally on your machine.

## Set up Nia

first-run uses the Nia CLI for its knowledge base. Install and authenticate:

```bash
npm install -g @nicepkg/nia
nia auth login
```

Or set your API key as an environment variable:

```bash
export FIRST_RUN_NIA_KEY=your-api-key
```

## Usage

### For maintainers — set up a project

Run this in your repo to install the skills, hooks, and index the repo in Nia:

```bash
first-run init
```

This installs:
- `.claude/skills/onboard/SKILL.md` — guided setup skill
- `.claude/skills/diagnose/SKILL.md` — error diagnosis skill
- `.claude/skills/upload-knowledge/SKILL.md` — knowledge sharing skill
- `.claude/hooks/check-errors.sh` — auto-detects errors and reminds Claude to save fixes
- `.claude/hooks/check-nia-search.sh` — reminds Claude to search the knowledge base first
- `.claude/settings.json` — wires the hooks
- `.first-run.json` — project config with Nia source ID

Commit the `.claude/` directory so contributors get the skills automatically.

### For contributors — onboard

Open Claude Code in the project and type:

```
/onboard
```

Claude will scan the repo, check your machine, install dependencies, configure env vars, and start the dev server — searching the community knowledge base for known fixes along the way.

### When you hit an error — `/diagnose`

```
/diagnose npm install fails with "Missing required environment variable: DIRECT_URL"
```

When you hit an error, `/diagnose` searches a database of fixes from every developer who's worked on this repo before you. If someone already hit the same problem and solved it, you get their fix instantly — no Googling, no asking in Slack.

You don't even need to type it — the error detection hook automatically triggers the diagnose flow whenever a command fails. Claude will:

1. Search the Nia knowledge base for known fixes
2. Apply the fix if one exists, or debug manually
3. Verify the fix works
4. Save the fix so the next person benefits

### Share what you learned — `/upload-knowledge`

```
/upload-knowledge
```

Found something useful? A gotcha, a tip, a workaround? Save it so the next developer doesn't have to figure it out again. Claude will walk you through capturing what you learned with the right category and context.

You can also save knowledge directly from the CLI:

```bash
first-run save -t "Prisma needs .env for DIRECT_URL" -c "Prisma CLI reads .env, not .env.local" --category gotcha
```

### CLI commands

```bash
# Initialize a repo (maintainer)
first-run init

# Ask the knowledge base a question
first-run ask "how to set up the database"

# Save a fix or tip
first-run save -t "Prisma needs .env" -c "Copy DATABASE_URL into .env for Prisma CLI" --category fix

# Save a fix (error/fix format)
first-run learn -e "missing DIRECT_URL" -f "copy from .env.local to .env"
```

### Categories for `first-run save`

| Category | Use case |
|----------|----------|
| `fix` | Error → solution |
| `tip` | General advice, shortcuts |
| `gotcha` | "Watch out for this" |
| `env` | Environment variable guidance |
| `prereq` | Missing prerequisites / tool setup |

## Development

```bash
npm run dev    # watch mode — rebuilds on changes
npm run build  # one-time build
```

To test changes in another project without republishing:

```bash
# In the first-run directory
npm link

# In the target project
npm link first-run
first-run init
```

The symlink means rebuilds in first-run are immediately available in the target project.
