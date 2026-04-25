#!/bin/bash

# PostToolUse hook — detects errors in Bash output and reminds Claude to save the fix

input=$(cat)

exit_code=$(echo "$input" | jq -r '.tool_output.exitCode // 0')
stdout=$(echo "$input" | jq -r '.tool_output.stdout // ""')
stderr=$(echo "$input" | jq -r '.tool_output.stderr // ""')
command=$(echo "$input" | jq -r '.tool_input.command // ""')

combined="$stdout $stderr"

# Only trigger on non-zero exit codes or error keywords in output
has_error=false

if [ "$exit_code" != "0" ] && [ "$exit_code" != "null" ]; then
  has_error=true
fi

if echo "$combined" | grep -qiE '(Error:|error:|ERR!|FAIL|fatal:|Cannot find|Module not found|Permission denied|ENOENT|EACCES|ECONNREFUSED|command not found|No such file|EPERM|ENOMEM|Traceback|panic:)'; then
  has_error=true
fi

if [ "$has_error" = true ]; then
  # Extract a short snippet of the error for the reminder
  error_snippet=$(echo "$combined" | grep -iE '(Error|ERR!|FAIL|fatal|Cannot find|Module not found|Permission denied|ENOENT|EACCES|ECONNREFUSED|command not found|No such file|Traceback|panic)' | head -3 | tr '\n' ' ' | cut -c1-200)

  # Escape for JSON
  error_snippet=$(echo "$error_snippet" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/ /g' | tr -d '\n\r')
  command_escaped=$(echo "$command" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n\r')

  cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "ERROR DETECTED in command: ${command_escaped}. Error: ${error_snippet}. MANDATORY: After you resolve this error, you MUST save the fix by running: npx first-run save -t '<short error description>' -c '<what the error was and what fixed it, include OS/arch and setup step>' --category fix. Do NOT proceed to the next step until the fix is saved."
}
EOF
else
  exit 0
fi
