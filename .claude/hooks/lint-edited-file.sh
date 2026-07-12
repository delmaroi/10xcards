#!/usr/bin/env bash
# PostToolUse (Write|Edit) hook: lint ONLY the file the agent just edited.
# Reads the hook JSON payload from stdin; scopes to lintable extensions.
# Exit 2 = blocking signal → ESLint output goes back into the agent's context.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

# Nothing to lint, or a file type we don't lint → succeed silently.
[ -z "$file" ] && exit 0
case "$file" in
  *.ts | *.tsx | *.astro) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f "$file" ] || exit 0  # file may have been deleted/moved

if ! output=$(npx eslint "$file" 2>&1); then
  echo "ESLint failed for $file — fix these before continuing:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
