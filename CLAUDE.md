# daggerheart-sleek-ui (fork) — CLAUDE.md

This repo is a personal fork of `pasoktcm/daggerheart-sleek-ui` (remote: `upstream`),
pushed to `Artieficr/daggerheart-sleek-ui` (remote: `origin`). It exists to merge in a
sliding card-hand panel — pulling cards from
[happytreedice-daggerheart-card-hand](https://github.com/Happytreedice/happytreedice-daggerheart-card-hand)'s
API — instead of running Card Hand as a separate floating panel.

Full project context (why this fork is separate from the hub module, the settings-preset
system it plugs into, license/API notes on the modules involved) lives in the sibling repo
`../foundry-quick-start/`, specifically:
- `../foundry-quick-start/CLAUDE.md` — index of everything else
- `../foundry-quick-start/.claude/context/architecture.md` — why this fork is its own repo
- `../foundry-quick-start/.claude/context/tracked-modules.md` — Card Hand API caveat (READ
  THIS before writing any integration code — the API is unverified against actual source)
- `../foundry-quick-start/NOTES.md` — running dev log, gitignored there, check it for the
  latest state before assuming anything here is finished

## Working rules

- Never run `git commit`/`git push` here without being asked in that moment — always the
  user's action, same rule as the sibling repo.
- Keep the `upstream` remote and periodically merge from it — don't let this fork drift
  so far it can't take pasoktcm's future fixes.
- No panel/integration code exists yet as of repo creation. Next step: read
  `scripts/floating-tabs.js` and `scripts/main.js` to find where a sliding panel should
  hook into the sheet layout.
