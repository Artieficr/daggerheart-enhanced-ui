# daggerheart-enhanced-ui (fork) — CLAUDE.md

This repo is a fork of `pasoktcm/daggerheart-sleek-ui` (remote: `upstream`, MIT-licensed —
see `LICENSE`), pushed to `Artieficr/daggerheart-enhanced-ui` (remote: `origin`). It started as a place to
merge in a sliding Card Hand panel, but as of 2026-09-07 it's developed as its own thing —
see "Working rules" below. The Card Hand panel (`scripts/card-hand.js`,
`styles/card-hand.css`, `assets/cardhand/`) is a direct port of
[happytreedice-daggerheart-card-hand](https://github.com/Happytreedice/happytreedice-daggerheart-card-hand)'s
actual code and visual assets, not an API integration — Card Hand's `registerTemplates`
API only feeds templates into its own standalone panel, it has no way to dock into another
module's UI. **Happytree's repo has no LICENSE file (all-rights-reserved default): the
ported code/assets are fine for personal use only, and must be stripped or rewritten before
this fork is ever published.**

**This repo is now the primary place work happens.** It started as a place to merge in
just the Card Hand panel, with a separate hub module (`../foundry-quick-start/`) meant to
be the main project; that plan is shelved (Quick Start's own settings-hub feature was
never built past a data-model TODO) and all active development moved here instead. Quick
Start's repo and docs still exist as a historical/reference record and may resume later —
read them only when a task is unmistakably about the hub module itself (the settings-preset
design, the tracked-module roster, the upstream-watch GitHub Actions), not by default:
- `../foundry-quick-start/CLAUDE.md` — index of its own docs
- `../foundry-quick-start/.claude/context/tracked-modules.md` — license/API notes on the
  four modules Quick Start tracks (including Happytree's Card Hand — see the license note
  above)
- `../foundry-quick-start/.claude/context/architecture.md` — why the multi-repo split was
  originally designed the way it was, and the note on why that's since paused
- `../foundry-quick-start/NOTES.md` — its own historical dev log, gitignored there; this
  repo's `NOTES.md` is the current one, not that file

## Working rules

- `NOTES.md` (gitignored) is the running scratch log — check it for the latest
  in-progress state before assuming anything here is finished; don't assume chat history
  survives between sessions. Entries are organized by topic, not date — don't add
  timestamps by default, only when the order changes genuinely matter (e.g. a decision
  that was later reversed, so it's clear which came first).
- `.claude/local-rules.md` (gitignored, may be absent on a fresh clone) — personal
  git/commit preferences. Check it before making any commit in this repo.
- When this file (or `NOTES.md`) goes stale — code moved, a decision changed — update it
  in the same change that caused the drift. Don't let it rot.
- **This fork no longer optimizes for clean upstream merges.** The previous rule here
  ("never split an upstream-authored file, never extract shared helpers, keep every file
  diffing cleanly against pasoktcm's layout") is retired. User's call: "let's just take
  over this fork completely. If anything cool will be made in the original — we will just
  compare and adopt their decisions." In practice: splitting files, extracting shared
  helpers (e.g. `scripts/sheets/minisheets/minisheet-position.js`, which replaced identical
  copy-pasted positioning logic across all five minisheet files), and otherwise
  restructuring source is now fine when it makes the code better. Upstream's future changes
  get reviewed and cherry-picked deliberately, not merged wholesale — the `upstream` remote
  is still worth keeping for that comparison, just not for a literal `git merge`.
- **No watch-upstream workflow lives in this repo, and none is needed.** Quick Start
  already tracks `pasoktcm/daggerheart-sleek-ui` (as its "Sleek UI" module) and opens a
  GitHub issue in `foundry-quick-start` on every new pasoktcm release — that issue IS the
  signal to come here, diff against the new tag, and decide what (if anything) to adopt.
  This still runs even with Quick Start itself paused; don't add a second tracker here.
- The file map below is for **navigation** (so a session touching one sheet doesn't need to
  read all ~7,400 lines of `scripts/`) — it may now drift from pasoktcm's own layout as this
  fork evolves; keep it updated when it does.

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
3. Define a `Enhanced*Sheet extends <that class>`, override `DEFAULT_OPTIONS`/`PARTS`, layer
   extra `_prepareContext` data on top of `super._prepareContext()`, add listeners.
4. Re-register via `foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor,
   "daggerheart", Enhanced*Sheet, { types: [...], makeDefault: true })`.

This means Enhanced UI never reimplements Foundryborne's data prep from scratch — it always
calls `super._prepareContext()` first and adds/reshapes on top. Any future integration
(the Card Hand sliding panel included) should follow the same shape: extend, call `super`,
add.

## File map — `scripts/`

| Path | Purpose |
| --- | --- |
| `main.js` | Entry point / hook wiring only (45 lines) — see "How the module loads" above. |
| `floating-tabs.js` | `FloatingTabs` — a standalone `ApplicationV2` (no window chrome, `tag: "nav"`) positioned via `getBoundingClientRect()` next to its owning sheet (`_position()`), tracked via `ResizeObserver`-free polling: a `MutationObserver` on the sheet's `class`/`style` (catches minimize), a `resize` listener on the sheet's own window (multi-window/pop-out aware — reads `ownerDocument.defaultView`), and `mousedown`/`focus` on the sheet to reposition on refocus. Only rendered when the `tabsPosition` setting is `"floating"`; the alternative `"basic"` mode bakes tabs directly into each sheet's own `tabs-basic.hbs` instead (see `settings.js`). One instance per open sheet, owned by `sheet.floatingTabs`, closed in the sheet's own `close()` override. |
| `helpers.js` | The shared grab-bag every sheet file imports from (517 lines, no sheet-specific logic). `preloadHandlebarsTemplates()` — the master template-path list (must be updated when adding any new `.hbs`; nothing else discovers templates automatically). Resource management: `toggleResourceManagement`/`toggleArmorManagement` open a locked tooltip (`game.tooltip.createLockedTooltip`) rendered from **the daggerheart system's own** tooltip templates (`systems/daggerheart/templates/ui/tooltip/*.hbs`), not this module's — Enhanced UI only supplies the trigger button + positioning. `dismissHoverTooltip` — mousemove-driven hover-tooltip dismissal, bound once per sheet in each `_onRender`. `recallDomainCardFromVault` — recall-cost dialog wrapper around the system's own `effect` action type. `isBeastformActive`/`getBeastformPortrait` — swaps the actor portrait for the beastform's ring subject texture when the `beastformPortrait` setting is on. `resolveUsesUnarmed`/`resolveUnarmedAttack` — reads the system's unarmed-attack fields across both a boolean-flag schema and a legacy schema (`sys.usesUnarmed` vs `sys.usedUnarmed`) so callers don't need to know which one a given actor has. `formatWeaponDamageDisplay` — builds the damage-formula HTML string (dice + type icons) for both the current `damage.main` schema and the legacy `damage.parts` schema; also used for the synthetic "unarmed attack" pseudo-item every actor sheet builds. `attachQuantityListeners` — the one inventory-quantity-input wiring, shared by every full sheet's inventory tab. `registerHelpers()` registers 4 trivial Handlebars helpers: `contains`, `eq`, `add`, `subtract`. |
| `settings.js` | Most `game.settings.register` calls (theme, themeChat, enableMinisheet, minisheetScale, tabsPosition [`floating`\|`basic`], showTooltip, currencyLabel, beastformPortrait) plus the apply-functions that inject `styles/theme.css`/`styles/theme-chat.css` `<link>` tags and set the minisheet's CSS transform via `sheets/minisheets/minisheet-position.js` (`scaleTransformFor`/`transformOriginFor`). No more `minisheetOffset` — every minisheet type anchors bottom-left now, so there was nothing left to offset. The old boolean `quickAccess` setting is gone too, superseded by `card-hand.js`'s `favoritesDisplayMode` (Quick Access / Standard). Also registers `minisheetVisible`/`minisheetPinnedActor` (`config:false`, client-scoped) — read/written by `sheets/minisheets/minisheet-pin.js`, not this file. |
| `card-hand.js` | The Card Hand panel — domain cards and ancestry/community/class/subclass/multiclass/transformation features, grouped one card per source item via each anchor's own `system.getLinkedItems()` (`buildFeatureGroups`). Weapons/consumables/the unarmed attack are NOT here — see `inventory-panel.js`. Settings: `favoritesDisplayMode` (Quick Access / Standard), `cardHandPosition`, internal `cardHandOpen` (remembered open/closed state — the Hand never closes on outside click, only its own toggle), `cardHandOrder` (client-scoped drag-reorder persistence, `{[actorId]: {main:[...], children:{[anchorUuid]:[...]}}}` — see `applyStoredOrder`/`getStoredOrder`/`setStoredOrder`/`getStoredChildOrder`/`setStoredChildOrder`). No filter of its own (everything this panel shows is a real card) but it does have a Reorder popover (`renderCardHandReorderPopover`/`renderReorderMainList`/`renderReorderChildList` — a plain sortable list of card titles, native HTML5 drag-and-drop via `attachReorderRowDnD`; a feature group's row drills into a second list for just its own members). Card-data prep (`buildHandCards` — returns `{kind:"item"\|"featureGroup", ...}`), DOM-diffing render (`renderCardHandWindow`/`reconcileCardHandList` — reconciles against the existing DOM instead of wiping it, so actor-item changes animate cards in/out and the fan reflows smoothly), card-face rendering (`renderCardFace`, ported near-verbatim from Happytree's Improved template — see the license note at the top of this file), the fan layout/compression math (`applyCardHandFanLayout` — also usable directly against a `.card-hand-list` element, not just a wrapper containing one), and the custom mouse-drag interaction (`attachGrabGesture`/`useHandCard` — dispatches per card kind; a feature group, even a single-member one, always opens `showFeatureGroupOverlay`, a centered fade-in fan of the actual member cards, never proxies straight to a lone feature — reordering *inside* the fan itself via this same drag gesture was tried and reverted, see NOTES.md). Every group also gets a real hover-revealed vertical sub-stack of its member cards (`.hand-card-substack`, built in `buildHandCardElement`, reusing the same function recursively) — full-text member cards are never flattened away, only visually tucked behind their parent, and stay behind the parent's own face (`:has()`-driven z-index) unless a specific child is itself focused. Every card's actual hover/drag/right-click hit target is `.hand-card-hitzone`, a fixed-size child kept separate from the enlarging `.dhc-scaler` preview (`pointer-events:none`) so a focused card's ballooning preview can't "steal" hover from its neighbor — width set per-card in `applyCardHandFanLayout`. Imports `refreshCharacterMiniSheet` from `minisheet-character.js` (for `favoritesDisplayMode`'s `onChange`) — a safe circular import, since neither module calls the other's export at top-level. Imported by `minisheet-character.js` only. |
| `inventory-panel.js` | The Inventory panel — weapons/armor/consumables/loot, the non-"real card" items Card Hand used to (wrongly) render as big cards. Reuses enhanced-ui's own existing compact-row partials (`card-weapon.hbs`/`card-armor.hbs`/`card-item.hbs`) and `attachFavoritesListeners` (from `utils-minisheet.js`) rather than a second card-rendering pipeline. Settings: four `config:false` show-toggles, `inventoryFilterEquippedOnly`, internal `inventoryOpen` (same "persistent HUD, remembers state" behavior as `cardHandOpen`). `buildInventoryContext` reads `actor.items` directly (cheap, no `enrichHTML`/hope-cost/uses-data parsing — an accepted simplification for a quick equipment browser). `renderInventoryFilterPopover` mirrors the filter-popover pattern Card Hand's own used to follow. Its window reuses Quick Access's own `.favorites-window-container`/`.favorites-window` CSS classes (alongside `.inventory-window-container`/`.inventory-window` for JS targeting) rather than duplicating that positioning/animation CSS — safe since Quick Access mode and Standard mode never render simultaneously. Imported by `minisheet-character.js` only. |
| `sheets/minisheets/minisheet-position.js` | Shared positioning helper for all five minisheets (`injectMinisheetContainer`, `idleTransform`, `collapsedTransform`, `scaleTransformFor`) — see its own header comment and "Known duplication" below for why this exists despite the "don't touch upstream duplication" framing elsewhere in this file being retired. Originally anchor-parameterized (character bottom-left, the other four center); now every minisheet type anchors bottom-left unconditionally, so the anchor parameter (and the `getWrapperAnchor` DOM-reading helper that went with it) was removed rather than left unused. |
| `sheets/minisheets/minisheet-pin.js` | Coordinates the Character and Companion minisheets against the "Toggle Mini Sheet" token-control button (registered here via `getSceneControlButtons`, into `controls.tokens.tools`) — `syncPinnedMinisheet()` is the single dispatcher: toggle off → both torn down regardless of token selection (frees the hotbar); toggle on + exactly one owned character/companion token controlled → unchanged token-driven display; toggle on + no single owned token (theater of mind, or 0/2+ controlled) → falls back to a "pinned" actor (`resolvePinnedActor`: last picked via `minisheetPinnedActor` setting, else `game.user.character`, else the first owned character/companion). Only character/companion actors participate — party/adversary/environment minisheets keep their own independent `controlToken` handling untouched, no "my own character" concept for those. `buildActorPickerContext()` feeds the "switch character" picker (`templates/components/minisheet-actor-picker.hbs`, wired by `utils-minisheet.js`'s `attachActorPickerListeners`) — shown only while displaying via the pin fallback with more than one pinnable actor, hidden outright for a single owned actor or while token-driven. Rendered as a sibling of `.portrait`, not nested inside it (`.portrait`'s own `mask-image` would clip/fade it otherwise) — its open panel is left-aligned to the portrait's own corner and can extend past the minisheet's own top edge (capped to 2x the minisheet's height, scrolling past that). Past 5 pinnable actors (`showExtras`, mainly a GM concern — a GM's pinnable pool is every character/companion in the world) it also gets a search box, a per-row favorite star (`minisheetPinnedFavorites` setting), and a second star-icon toggle opening a favorites-only view of the same list (right-click there removes a favorite via a small context menu appended to `document.body` — has to escape `.minisheet-transform-wrapper`'s `transform`, which would otherwise hijack `position:fixed` coordinates). Registered at `init` (not `ready`, unlike the module's other `register*` calls) specifically so its `getSceneControlButtons` listener is in place before Foundry's SceneControls does its one-time-only first render; the initial display sync on load (`syncPinnedMinisheet()`) still has to wait for `ready`, called directly from `main.js` after the minisheet classes exist. `showCharacterMiniSheetActor`/`teardownCharacterMiniSheet` and their Companion equivalents (exported from those two files) are this coordinator's only way to actually mount/unmount either class — deliberately circular imports (this file imports those two, `utils-minisheet.js` imports back from this file), safe because nothing here is called at module top-level. |
| `sheets/character-sheet.js` | **Largest file (1509 lines).** `EnhancedCharacterSheet extends daggerheart.CharacterSheet`. Two-part layout (`sidebar` + `mainSheet`). Owns the most state of any sheet: `tabs` (features/loadout/inventory/biography/effects), `collapsedCategories` (persisted via actor flag `daggerheart-enhanced-ui.collapsedCategories`), `openCards` (Set, NOT persisted — card-expand state survives same-session re-renders only), `hoveredCompactCard`, and a **static** `draggedItem` (cross-actor item transfer state, read by the `preCreateItem` hook registered at the bottom of this file — the mechanism that lets dragging an item from one open character sheet onto another actually move it instead of copying it). `_prepareContext` composes five independent data-prep methods (`_prepareFeaturesData`/`_prepareLoadoutData`/`_prepareInventoryData`/`_prepareEffectsData`/`_prepareBiographyData`) plus `_prepareQuickAccessData` (resolves the `quickAccess` actor-flag UUID list against the other four's already-built item data, so Quick Access never re-shapes an item, just references it). Has a `//// HOTPOT INTEGRATION ////`-fenced block (ingredient inventory tab support for the separate `hotpot-daggerheart` module, `game.modules.get("hotpot-daggerheart")?.active`-gated) — the one place third-party-module interop lives outside the four tracked modules. `_onDrop` handles three distinct drop targets by inspecting `event.target.closest(...)`: Quick Access reorder, same-actor item reorder (writes `sort` on all siblings), and cross-actor transfer (create then delete, `ui.notifications.info`). `render()` override redirects to the vanilla system sheet when the viewer has `limited` (not `owner`) permission — same override appears in every other full sheet file. |
| `sheets/party-sheet.js` | **Second largest (954 lines).** `EnhancedPartySheet extends daggerheart.PartySheet`. Two-part layout (`mainSheet` + `partyMembers`, the latter re-rendered alone via `render(false, { parts: ["partyMembers"] })` whenever a member actor/item/effect updates — see the `updateActor`/`updateItem`/`updateActiveEffect` hooks at the bottom). `_preparePartyMembersData` re-derives each member's hope/HP/stress/armor/evasion/attributes/primary+secondary weapon independently of that member's own sheet — **not** shared with `character-sheet.js`'s equivalent prep, a real duplication (see "Known duplication" below). Has its own `_onDropActor` (adding a character/companion/adversary actor as a party member — `ALLOWED` type allowlist) alongside the same three-target `_onDrop` shape as the character sheet (minus Quick Access, which is character-only). |
| `sheets/adversary-sheet.js` | (608 lines) `EnhancedAdversarySheet extends daggerheart.AdversarySheet`. Two-part layout (`sidebar` + `mainSheet`) plus a `limited` part pointing at the **system's own** limited-view template (`systems/daggerheart/templates/sheets/actors/character/limited.hbs`) rather than one of this module's. Tabs: features/effects/notes. Fear-cost tags instead of hope-cost. Listens for `updateSetting` on the world Fear resource to re-render every open adversary sheet when Fear changes globally. |
| `sheets/companion-sheet.js` | (368 lines) `EnhancedCompanionSheet extends daggerheart.DhCompanionSheet` — note the upstream class name is `DhCompanionSheet`, not `CompanionSheet`. Single-part layout (`mainSheet` only — no separate sidebar). Resolves `system.partner` (a UUID string or already-resolved document, checked both ways) for the partner-attack display. Smallest of the five full sheets — no drag/drop, no Quick Access, no collapsedCategories persistence beyond the one category group. |
| `sheets/environment-sheet.js` | (418 lines) `EnhancedEnvironmentSheet extends daggerheart.DhpEnvironment` — note the upstream class name is `DhpEnvironment`. Tabs: features/potentialAdversaries/notes. `_preparePotentialAdversariesData` resolves a category → adversary-UUID-or-actor list, re-fetching by UUID whenever a value looks unresolved (compendium entries commonly arrive this way) or is missing expected system fields. Same Fear `updateSetting` re-render hook as the adversary sheet. |
| `sheets/minisheets/utils-minisheet.js` | **Shared plumbing for all 5 minisheet classes** (706 lines) — not a sheet itself. Macrobar hide/show (`#hotbar`), the collapse/expand animation + reopen-button injection (`collapseMinisheet`/`injectReopenButton`/`removeReopenButton`), the `Alt+C` keybinding (`registerMinisheetKeybinding`), and resource-listener attachers (`attachHopeListeners`/`attachResourceListeners`/`attachToggleResourceListeners`/`attachTraitRollListeners`/`attachDowntimeListeners`/`attachReactionRollListeners`) that each minisheet wires against its own root element. **`attachFavoritesListeners`/`renderFavorites`** are the biggest piece: the same dispatcher backs both the full character sheet's sidebar "favorites" panel AND every minisheet's compact-card popout window (`isMinisheet` flag only changes which subset of listeners attach — e.g. expand-on-click vs. navigate-to-full-sheet-tab). If you're touching favorites/quick-access card behavior, this file is more likely the real owner than the sheet file that renders the panel. `attachActorPickerListeners` wires the Character/Companion minisheets' "switch character" picker (see `minisheet-pin.js`) — main/favorites toggle clicks, search-box filtering (`.search-hidden` class per row), per-row star clicks, and the favorites-only right-click "remove" menu; also sets the open panel's `max-height` inline each render (2x the minisheet's own measured height). All rebound harmlessly on every render; the picker's outside-click-to-close is a single global listener registered once in `minisheet-pin.js` instead, to avoid stacking a `document` listener on every re-render. |
| `sheets/minisheets/minisheet-character.js` | (445 lines) Exports `refreshCharacterMiniSheet()` (a module-scope reference to the class below, set once it's created — needed since `card-hand.js`'s `favoritesDisplayMode` setting must force a real re-render on change, not just a re-style, and the class itself is scoped inside `registerCharacterMiniSheet()`'s closure) and, for `minisheet-pin.js`'s coordinator, `showCharacterMiniSheetActor(actor)`/`teardownCharacterMiniSheet()`. `CharacterMiniSheet` — a **static-only class**, no instances; state lives entirely on the class (`currentActor`, `element`). Token-selection-driven display is decided by `minisheet-pin.js`'s shared `controlToken` listener, not a listener bound in this file — see that file for the full toggle/pin/theater-of-mind logic (its full sheet isn't already open still gates it via the `renderEnhancedCharacterSheet`/`closeEnhancedCharacterSheet` hooks at the bottom of this file, which hand off between minisheet and full sheet). Renders straight HTML via `foundry.applications.handlebars.renderTemplate` into a hand-built `#enhanced-ui-sheet` div appended to `document.body` — **not** an `ApplicationV2`, unlike `FloatingTabs`. `_patchTooltipManager` monkey-patches `game.tooltip._setAnchor` once (guarded by `_tooltipPatched`) so tooltips inside the minisheet anchor upward from the bottom of the screen instead of the default direction. `_mountEffectsDisplay`/`_unmountEffectsDisplay` physically relocate Foundry's global `#effects-display` element into the minisheet while it's open and back out on close/collapse — a real DOM-ownership handoff, not a copy. `_prepareContext` reuses `actor.sheet._prepareContext({})` **only when the actor's current sheet is the Enhanced sheet** (`isEnhancedSheet` check) — otherwise (default Foundry sheet, or another module's) it hand-rolls a reduced version of weapons/armors/loadout/unarmed data inline, since the system's own `_prepareContext` shape can't be assumed compatible. Also builds `actorPicker` context via `minisheet-pin.js`'s `buildActorPickerContext`. |
| `sheets/minisheets/minisheet-companion.js` | (376 lines) `CompanionMiniSheet` — same static-class/tooltip-patch/effects-mount shape as the character minisheet, trimmed (no Quick Access, no favorites window persistence). Its `_attachListeners` hand-rolls a companion "action roll" (mirroring the system's own `#actionRoll` private method, since that isn't exposed for reuse) and a resource-consumption step afterward. Exports `showCompanionMiniSheetActor`/`teardownCompanionMiniSheet` for `minisheet-pin.js`, same pattern as the character file; token-driven display likewise goes through that coordinator's shared `controlToken` listener rather than one bound here. |
| `sheets/minisheets/minisheet-party.js` | (273 lines) `PartyMiniSheet` — the simplest of the five: no tooltip patch, no effects display (party actors don't have their own effects display), no favorites window. `_prepareContext` re-derives each member's pip data independently (third copy of similar logic alongside `party-sheet.js` and `character-sheet.js` — see "Known duplication"). Clicking a member portrait pans/selects that member's token on canvas if one exists, else opens their sheet directly. |
| `sheets/minisheets/minisheet-adversary.js` | (409 lines) `AdversaryMiniSheet` — same tooltip-patch/effects-mount shape as character/companion. `_prepareContext` **does** reuse `actor.sheet._prepareContext({})` unconditionally (no `isEnhancedSheet` branch, unlike the character minisheet) to get `adversaryFeatures` for free. Features panel reuses `attachFavoritesListeners` from `utils-minisheet.js` even though this isn't a "favorites" concept for adversaries — the card markup is identical, so the same listeners apply as-is. |
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

## Known duplication (documented; fair game to deduplicate — see Working rules)

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
- Tooltip-patch / effects-display mount-unmount / collapse-reopen-button blocks are
  near-identical across `minisheet-character.js`, `minisheet-companion.js`,
  `minisheet-adversary.js` (party and environment are trimmed variants without the
  effects-display piece). The screen-anchoring piece of this (`_injectContainer` and the
  `translateX(-50%)`/collapse-transform literals) was already extracted, 2026-09-07, into
  `scripts/sheets/minisheets/minisheet-position.js` — see that file's own header comment.

This is upstream's own duplication (predates the fork). Per the reversed mergeability
stance above, none of it is off-limits to extract — the positioning piece already was (see
`minisheet-position.js`). The rest is just not done yet; pick it up when it's actually in
the way of something, not as a standalone cleanup pass.

## Card Hand panel

Built — see `card-hand.js` in the file map above, and this repo's own `NOTES.md` for the
full build history (why it directly ports Happytree's code/assets instead of using its
`registerTemplates` API — that API can't dock into a foreign host UI, verified by reading
its actual source — and the license consequence that follows from that). It renders inside
`minisheet-character.js` only, gated behind the `favoritesDisplayMode` setting being set to
`"hand"`.
