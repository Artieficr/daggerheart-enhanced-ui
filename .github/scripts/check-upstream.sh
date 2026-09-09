#!/usr/bin/env bash
# Checks tracked upstream repos (.github/upstream-sources.json) for a new release
# tag or a changed LICENSE file, opens a GitHub issue on any change, updates the
# stored baseline, and exits non-zero if anything changed (so the Actions run goes red).
#
# Ported from the abandoned foundry-quick-start hub module's own copy of this script
# (2026-09-09) — logic unchanged, only .github/upstream-sources.json's tracked-repo list
# differs (this repo tracks the three sources it actually forks/ports code from, not a
# general "modules we might care about" roster).
set -euo pipefail

MODE="${1:?usage: check-upstream.sh <releases|license>}"
DATA_FILE=".github/upstream-sources.json"
CHANGED=0
NOTES=()

count=$(jq '.modules | length' "$DATA_FILE")

for i in $(seq 0 $((count - 1))); do
  repo=$(jq -r ".modules[$i].repo" "$DATA_FILE")
  name=$(jq -r ".modules[$i].name" "$DATA_FILE")
  id=$(jq -r ".modules[$i].id" "$DATA_FILE")

  if [ "$MODE" = "releases" ]; then
    key="lastSeenRelease"
    label="release"
    current=$(gh api "repos/$repo/releases/latest" --jq '.tag_name' 2>/dev/null || echo "NONE")
  else
    key="lastSeenLicenseSha"
    label="license"
    current=$(gh api "repos/$repo/license" --jq '.sha' 2>/dev/null || echo "NONE")
  fi

  previous=$(jq -r ".modules[$i].$key" "$DATA_FILE")

  if [ "$previous" != "null" ] && [ "$previous" != "$current" ]; then
    CHANGED=1
    NOTES+=("- **$name** (\`$id\`): $label changed from \`$previous\` to \`$current\` — https://github.com/$repo")
  fi

  jq --arg v "$current" ".modules[$i].$key = \$v" "$DATA_FILE" > tmp.json && mv tmp.json "$DATA_FILE"
done

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add "$DATA_FILE"
if ! git diff --cached --quiet; then
  git commit -m "chore: update upstream $MODE tracking"
  git push
fi

if [ "$CHANGED" -eq 1 ]; then
  BODY=$(printf '%s\n' "${NOTES[@]}")
  gh issue create --title "Upstream $MODE change detected" --body "$BODY"
  echo "::error::Upstream $MODE change detected — see the created issue."
  exit 1
fi
