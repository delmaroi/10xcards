#!/usr/bin/env bash
# Stop hook: run the project-wide type check once, when the agent finishes a turn.
# `astro check` scans the whole project (~seconds), so it runs here rather than
# per-edit — per the test-plan/hook performance guidance. Exit 2 = blocking.
set -uo pipefail

# Ensure Node.js >=22 is on PATH (nvm subshell may default to an older version)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22 --silent 2>/dev/null || true
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! output=$(npx astro check 2>&1); then
  echo "astro check found type errors — resolve before finishing:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
