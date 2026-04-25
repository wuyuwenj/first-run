#!/bin/bash

# PreToolUse hook — reminds Claude to search Nia before reading repo files

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // ""')

# Only apply to Read and Glob tools
if [ "$tool_name" != "Read" ] && [ "$tool_name" != "Glob" ]; then
  exit 0
fi

# If Nia was already searched in this session, stop reminding
if [ -f "/tmp/first-run-nia-asked" ]; then
  exit 0
fi

# Check if this is reading a repo file (not a system/tmp file)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.pattern // ""')

# Skip non-repo reads (tmp files, node_modules, .claude config)
if echo "$file_path" | grep -qE '(^/tmp|^/private/tmp|node_modules|\.claude/)'; then
  exit 0
fi

cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "REMINDER: You have not searched the Nia knowledge base yet. Before reading repo files to understand setup, you MUST first run these commands:\n\nnpx first-run ask \"how to set up this project\"\nnpx first-run ask \"common setup errors\"\nnpx first-run ask \"environment variables\"\n\nNia may already have answers from previous contributors. Search first, then read files."
}
EOF
