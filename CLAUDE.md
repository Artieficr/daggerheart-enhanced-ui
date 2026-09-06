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

- `.claude/local-rules.md` (gitignored, may be absent on a fresh clone) — personal
  git/commit preferences. Check it before making any commit in this repo.
- Keep the `upstream` remote and periodically merge from it — don't let this fork drift so
  far it can't take pasoktcm's future fixes.
- **No watch-upstream workflow lives in this repo, and none is needed.** Quick Start
  already tracks `pasoktcm/daggerheart-sleek-ui` (as its "Sleek UI" module) and opens a
  GitHub issue in `foundry-quick-start` on every new pasoktcm release — that issue IS the
  signal to come here, diff against the new tag, and merge. Decided 2026-09-06 after
  checking for redundancy; don't add a second tracker here.
- **Never split an upstream-authored file into multiple files, and don't extract shared
  helpers out of upstream code just to deduplicate it**, even where the file map below
  flags real duplication. This file's layout IS pasoktcm's layout; every future
  `git merge upstream/main` diffs against it file-for-file. Restructuring source (as
  opposed to documentation) makes every future merge on that file a manual reconciliation
  instead of a clean apply. Confirmed with the user 2026-09-06 — don't re-raise this
  without new information.
- The file map below is for **navigation only** (so a session touching one sheet doesn't
  need to read all ~7,400 lines of `scripts/`) — it is not a refactor proposal.

## How the module loads

`module.json`'s `esmodules` list is only `["scripts/floating-tabs.js", "scripts/main.js"]`
— everything else loads transitively through `main.js`'s imports. Hook order (`main.js`):
`init` → preload all Handlebars templates + register the 4 custom helpers + register
settings + register the minisheet keybinding; `ready` (non-`once`) → apply theme/minisheet
CSS+transform; `ready` (`once`) → register all 5 full sheets, then all 5 minisheets.

## The core pattern: extend, don't replace

Every `register*Sheet()` function in `scripts/sheets/*.js` follows the same shape:
1. Bail if `game.system.id !== "daggerheart"`.
2. Look up Foundryborne's own registered sheet class off `CONFIG.Actor.sheetClasses.<type>`
   (e.g. `daggerheart.CharacterSheet`) — bail if it isn't there.
3. Define a `Sleek*Sheet extends <that class>`, override `DEFAULT_OPTIONS`/`PARTS`, layer
   extra `_prepareContext` data on top of `super._prepareContext()`, add listeners.
4. Re-register via `foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor,
   "daggerheart", Sleek*Sheet, { types: [...], makeDefault: true })`.

This means Sleek UI never reimplements Foundryborne's data prep from scratch — it always
calls `super._prepareContext()` first and adds/reshapes on top. Any future integration
(the Card Hand sliding panel included) should follow the same shape: extend, call `super`,
add.

## File map — `scripts/`

| Path | Purpose |
| --- | --- |
| `main.js` | Entry point / hook wiring only (45 lines) — see "How the module loads" above. |
| `floating-tabs.js` | `FloatingTabs` — a standalone `ApplicationV2` (no window chrome, `tag: "nav"`) positioned via `getBoundingClientRect()` next to its owning sheet (`_position()`), tracked via `ResizeObserver`-free polling: a `MutationObserver` on the sheet's `class`/`style` (catches minimize), a `resize` listener on the sheet's own window (multi-window/pop-out aware — reads `ownerDocument.defaultView`), and `mousedown`/`focus` on the sheet to reposition on refocus. Only rendered when the `tabsPosition` setting is `"floating"`; the alternative `"basic"` mode bakes tabs directly into each sheet's own `tabs-basic.hbs` instead (see `settings.js`). One instance per open sheet, owned by `sheet.floatingTabs`, closed in the sheet's own `close()` override. |
| `helpers.js` | The shared grab-bag every sheet file imports from (517 lines, no sheet-specific logic). `preloadHandlebarsTemplates()` — the master template-path list (must be updated when adding any new `.hbs`; nothing else discovers templates automatically). Resource management: `toggleResourceManagement`/`toggleArmorManagement` open a locked tooltip (`game.tooltip.createLockedTooltip`) rendered from **the daggerheart system's own** tooltip templates (`systems/daggerheart/templates/ui/tooltip/*.hbs`), not this module's — Sleek UI only supplies the trigger button + positioning. `dismissHoverTooltip` — mousemove-driven hover-tooltip dismissal, bound once per sheet in each `_onRender`. `recallDomainCardFromVault` — recall-cost dialog wrapper around the system's own `effect` action type. `isBeastformActive`/`getBeastformPortrait` — swaps the actor portrait for the beastform's ring subject texture when the `beastformPortrait` setting is on. `resolveUsesUnarmed`/`resolveUnarmedAttack` — reads the system's unarmed-attack fields across both a boolean-flag schema and a legacy schema (`sys.usesUnarmed` vs `sys.usedUnarmed`) so callers don't need to know which one a given actor has. `formatWeaponDamageDisplay` — builds the damage-formula HTML string (dice + type icons) for both the current `damage.main` schema and the legacy `damage.parts` schema; also used for the synthetic "unarmed attack" pseudo-item every actor sheet builds. `attachQuantityListeners` — the one inventory-quantity-input wiring, shared by every full sheet's inventory tab. `registerHelpers()` registers 4 trivial Handlebars helpers: `contains`, `eq`, `add`, `subtract`. |
| `settings.js` | All `game.settings.register` calls (theme, themeChat, enableMinisheet, minisheetScale/Offset, tabsPosition [`floating`\|`basic`], quickAccess, showTooltip, currencyLabel, beastformPortrait) plus the apply-functions that inject `styles/theme.css`/`styles/theme-chat.css` `<link>` tags and set the minisheet's CSS transform (scale + horizontal offset, read together since they share one `transform` string). |
| `sheets/character-sheet.js` | **Largest file (1509 lines).** `SleekCharacterSheet extends daggerheart.CharacterSheet`. Two-part layout (`sidebar` + `mainSheet`). Owns the most state of any sheet: `tabs` (features/loadout/inventory/biography/effects), `collapsedCategories` (persisted via actor flag `daggerheart-sleek-ui.collapsedCategories`), `openCards` (Set, NOT persisted — card-expand state survives same-session re-renders only), `hoveredCompactCard`, and a **static** `draggedItem` (cross-actor item transfer state, read by the `preCreateItem` hook registered at the bottom of this file — the mechanism that lets dragging an item from one open character sheet onto another actually move it instead of copying it). `_prepareContext` composes five independent data-prep methods (`_prepareFeaturesData`/`_prepareLoadoutData`/`_prepareInventoryData`/`_prepareEffectsData`/`_prepareBiographyData`) plus `_prepareQuickAccessData` (resolves the `quickAccess` actor-flag UUID list against the other four's already-built item data, so Quick Access never re-shapes an item, just references it). Has a `//// HOTPOT INTEGRATION ////`-fenced block (ingredient inventory tab support for the separate `hotpot-daggerheart` module, `game.modules.get("hotpot-daggerheart")?.active`-gated) — the one place third-party-module interop lives outside the four tracked modules. `_onDrop` handles three distinct drop targets by inspecting `event.target.closest(...)`: Quick Access reorder, same-actor item reorder (writes `sort` on all siblings), and cross-actor transfer (create then delete, `ui.notifications.info`). `render()` override redirects to the vanilla system sheet when the viewer has `limited` (not `owner`) permission — same override appears in every other full sheet file. |
| `sheets/party-sheet.js` | **Second largest (954 lines).** `SleekPartySheet extends daggerheart.PartySheet`. Two-part layout (`mainSheet` + `partyMembers`, the latter re-rendered alone via `render(false, { parts: ["partyMembers"] })` whenever a member actor/item/effect updates — see the `updateActor`/`updateItem`/`updateActiveEffect` hooks at the bottom). `_preparePartyMembersData` re-derives each member's hope/HP/stress/armor/evasion/attributes/primary+secondary weapon independently of that member's own sheet — **not** shared with `character-sheet.js`'s equivalent prep, a real duplication (see "Known duplication" below). Has its own `_onDropActor` (adding a character/companion/adversary actor as a party member — `ALLOWED` type allowlist) alongside the same three-target `_onDrop` shape as the character sheet (minus Quick Access, which is character-only). |
| `sheets/adversary-sheet.js` | (608 lines) `SleekAdversarySheet extends daggerheart.AdversarySheet`. Two-part layout (`sidebar` + `mainSheet`) plus a `limited` part pointing at the **system's own** limited-view template (`systems/daggerheart/templates/sheets/actors/character/limited.hbs`) rather than one of this module's. Tabs: features/effects/notes. Fear-cost tags instead of hope-cost. Listens for `updateSetting` on the world Fear resource to re-render every open adversary sheet when Fear changes globally. |
| `sheets/companion-sheet.js` | (368 lines) `SleekCompanionSheet extends daggerheart.DhCompanionSheet` — note the upstream class name is `DhCompanionSheet`, not `CompanionSheet`. Single-part layout (`mainSheet` only — no separate sidebar). Resolves `system.partner` (a UUID string or already-resolved document, checked both ways) for the partner-attack display. Smallest of the five full sheets — no drag/drop, no Quick Access, no collapsedCategories persistence beyond the one category group. |
| `sheets/environment-sheet.js` | (418 lines) `SleekEnvironmentSheet extends daggerheart.DhpEnvironment` — note the upstream class name is `DhpEnvironment`. Tabs: features/potentialAdversaries/notes. `_preparePotentialAdversariesData` resolves a category → adversary-UUID-or-actor list, re-fetching by UUID whenever a value looks unresolved (compendium entries commonly arrive this way) or is missing expected system fields. Same Fear `updateSetting` re-render hook as the adversary sheet. |
| `sheets/minisheets/utils-minisheet.js` | **Shared plumbing for all 5 minisheet classes** (706 lines) — not a sheet itself. Macrobar hide/show (`#hotbar`), the collapse/expand animation + reopen-button injection (`collapseMinisheet`/`injectReopenButton`/`removeReopenButton`), the `Alt+C` keybinding (`registerMinisheetKeybinding`), and resource-listener attachers (`attachHopeListeners`/`attachResourceListeners`/`attachToggleResourceListeners`/`attachTraitRollListeners`/`attachDowntimeListeners`/`attachReactionRollListeners`) that each minisheet wires against its own root element. **`attachFavoritesListeners`/`renderFavorites`** are the biggest piece: the same dispatcher backs both the full character sheet's sidebar "favorites" panel AND every minisheet's compact-card popout window (`isMinisheet` flag only changes which subset of listeners attach — e.g. expand-on-click vs. navigate-to-full-sheet-tab). If you're touching favorites/quick-access card behavior, this file is more likely the real owner than the sheet file that renders the panel. |
| `sheets/minisheets/minisheet-character.js` | (445 lines) `CharacterMiniSheet` — a **static-only class**, no instances; state lives entirely on the class (`currentActor`, `element`). Driven by `controlToken`: shows when exactly one owned `character`-type token is selected AND its full sheet isn't already open (`renderSleekCharacterSheet`/`closeSleekCharacterSheet` hooks hand off between minisheet and full sheet). Renders straight HTML via `foundry.applications.handlebars.renderTemplate` into a hand-built `#sleek-ui-sheet` div appended to `document.body` — **not** an `ApplicationV2`, unlike `FloatingTabs`. `_patchTooltipManager` monkey-patches `game.tooltip._setAnchor` once (guarded by `_tooltipPatched`) so tooltips inside the minisheet anchor upward from the bottom of the screen instead of the default direction. `_mountEffectsDisplay`/`_unmountEffectsDisplay` physically relocate Foundry's global `#effects-display` element into the minisheet while it's open and back out on close/collapse — a real DOM-ownership handoff, not a copy. `_prepareContext` reuses `actor.sheet._prepareContext({})` **only when the actor's current sheet is the Sleek sheet** (`isSleekSheet` check) — otherwise (default Foundry sheet, or another module's) it hand-rolls a reduced version of weapons/armors/loadout/unarmed data inline, since the system's own `_prepareContext` shape can't be assumed compatible. |
| `sheets/minisheets/minisheet-companion.js` | (376 lines) `CompanionMiniSheet` — same static-class/tooltip-patch/effects-mount shape as the character minisheet, trimmed (no Quick Access, no favorites window persistence). Its `_attachListeners` hand-rolls a companion "action roll" (mirroring the system's own `#actionRoll` private method, since that isn't exposed for reuse) and a resource-consumption step afterward. |
| `sheets/minisheets/minisheet-party.js` | (273 lines) `PartyMiniSheet` — the simplest of the five: no tooltip patch, no effects display (party actors don't have their own effects display), no favorites window. `_prepareContext` re-derives each member's pip data independently (third copy of similar logic alongside `party-sheet.js` and `character-sheet.js` — see "Known duplication"). Clicking a member portrait pans/selects that member's token on canvas if one exists, else opens their sheet directly. |
| `sheets/minisheets/minisheet-adversary.js` | (409 lines) `AdversaryMiniSheet` — same tooltip-patch/effects-mount shape as character/companion. `_prepareContext` **does** reuse `actor.sheet._prepareContext({})` unconditionally (no `isSleekSheet` branch, unlike the character minisheet) to get `adversaryFeatures` for free. Features panel reuses `attachFavoritesListeners` from `utils-minisheet.js` even though this isn't a "favorites" concept for adversaries — the card markup is identical, so the same listeners apply as-is. |
| `sheets/minisheets/minisheet-environment.js` | (489 lines) `EnvironmentMiniSheet` — the one minisheet with a second display mode: **scene mode**, showing 2+ environment minisheets side-by-side when no token is selected and the current scene has multiple Daggerheart "scene environments" (`game.system.api.data.scenes.DHScene(canvas.scene.flags.daggerheart)`). `_syncDisplay`/`_syncSceneDisplay` is the priority chain: one selected token wins over scene mode; 2+ scene environments → scene mode; exactly 1 → single mode; 0 → teardown. Scene-mode hover behavior (`_attachSceneExpandListeners`) expands one environment's features panel on hover with a 75ms transfer delay so hovering across adjacent cards doesn't flicker-collapse/reopen. |

## Templates & styles (not itemized — see directory shape instead)

`templates/sheets/<type>/` mirrors each full sheet's own tab/section breakdown 1:1 (e.g.
`characters/main/`, `characters/tabs/`); `templates/components/` holds the ~30 shared
partials (card/resource/tab building blocks) every sheet type's templates pull in via
Handlebars partials — check `helpers.js`'s `preloadHandlebarsTemplates()` list for the
authoritative full path list rather than `find`-ing the directory. `styles/*.css` is one
file per actor type plus `components.css` (shared card/resource chrome), `style.css`
(base), `header.css`/`sidebar.css`/`tabs.css` (layout chrome), `minisheets.css`, and
`theme.css`/`theme-chat.css` (the optional Foundryborne-window/chat-card reskins gated by
the `theme`/`themeChat` settings — these two are the only stylesheets NOT in `module.json`'s
`styles` list, since they're injected conditionally by `settings.js` instead of always-on).

## Known duplication (documented, not touched — see Working rules)

- The resource-pip listener battery (uses/simple/die/dice-resource click+contextmenu
  increment/decrement against `fromUuid(itemUuid)` + `item.system.resource.value`) is
  near-identical across `character-sheet.js`, `party-sheet.js`, `adversary-sheet.js`, and
  again inside `utils-minisheet.js` (as standalone functions instead of class methods).
- Inventory item-shaping (`createWeaponData`/`createArmorData`/`createBaseData`, tag
  building) is duplicated almost verbatim between `character-sheet.js`'s
  `_prepareInventoryData` and `party-sheet.js`'s.
- Party-member pip/stat derivation exists in three places: `party-sheet.js`
  (`_preparePartyMembersData`), `minisheet-party.js` (`_prepareContext`), and indirectly
  reused via `character-sheet.js` for the acting character's own stats.
- Tooltip-patch / effects-display mount-unmount / collapse-reopen-button /
  `_injectContainer` blocks are near-identical across `minisheet-character.js`,
  `minisheet-companion.js`, `minisheet-adversary.js` (party and environment are trimmed
  variants without the effects-display piece).

This is upstream's own duplication (predates the fork), not something introduced here. Per
Working rules, it stays as-is — extracting it would fork pasoktcm's file structure further
than the actual sliding-panel feature requires.

## Sliding Card Hand panel — where it hooks in

Not yet built. Best current candidates based on the read above:
- `sheet-sidebar.hbs` (character) already renders the `favorites.hbs` partial — a sliding
  panel is more likely a sibling addition next to `.sidebar-content` or a new `FloatingTabs`-
  style standalone `ApplicationV2` (see `floating-tabs.js` for the pattern: unframed,
  positioned via `getBoundingClientRect()` against the sheet, torn down in `close()`).
- Card Hand's `registerTemplates` hook (see tracked-modules.md — **unverified**, read
  Card Hand's actual `scripts/main.js` before building against it) would supply
  `renderCard`/`renderPanel` per template; the panel would call into that API rather than
  reimplement card rendering, mirroring how this module leans on the daggerheart system's
  own tooltip templates in `helpers.js` instead of rebuilding them.
