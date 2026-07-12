#!/usr/bin/env bash
# PostToolUse (Write|Edit) hook: run ONLY the tests related to the edited file.
# Uses Vitest's import-graph awareness so editing src/lib/route-access.ts runs
# route-access.test.ts, while editing an unrelated file runs nothing.
# AI_AGENT=1 → compact reporter (Vitest 4.1+). Exit 2 = blocking on failure.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file" ] && exit 0
case "$file" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f "$file" ] || exit 0

export AI_AGENT=1

# Editing a test file → run it directly. Editing source → run its related tests.
case "$file" in
  *.test.ts | *.spec.ts) output=$(npx vitest run "$file" 2>&1); status=$? ;;
  *) output=$(npx vitest related "$file" --run 2>&1); status=$? ;;
esac

# "No test files found" (nothing related) is success, not a failure.
if [ "$status" -ne 0 ] && ! printf '%s' "$output" | grep -qi "No test files found"; then
  echo "Related tests failed for $file:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
