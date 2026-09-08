/**
 * Coordinates the Character and Companion minisheets against the "Toggle Mini
 * Sheet" token-control button, layered on top of their existing
 * token-selection-driven display. Three cases this reconciles into one
 * `syncPinnedMinisheet()` call:
 *   1. The toggle is off — neither minisheet shows, even with a token
 *      selected (lets a player free up the hotbar without digging into the
 *      module settings menu).
 *   2. The toggle is on and exactly one owned character/companion token is
 *      selected — unchanged token-driven behavior, previously each class's
 *      own `_onControlToken` handled this independently.
 *   3. The toggle is on and no single owned token is selected (theater of
 *      mind, or 0/2+ tokens controlled) — falls back to a "pinned" actor:
 *      whichever the player last picked, else their assigned `game.user
 *      .character`, else the first owned character/companion. This is what
 *      makes the minisheet reachable with no token on the scene at all.
 *
 * Only "character" and "companion" actor types participate — the party/
 * adversary/environment minisheets are GM/scene-driven tools with no "my own
 * character" concept, so they keep their independent controlToken handling
 * untouched.
 */

import { showCharacterMiniSheetActor, teardownCharacterMiniSheet } from "./minisheet-character.js";
import { showCompanionMiniSheetActor, teardownCompanionMiniSheet } from "./minisheet-companion.js";

const MODULE_ID = "daggerheart-sleek-ui";
const PINNABLE_TYPES = ["character", "companion"];

function hasOwnerLevel(actor) {
  const ownerLevel = game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : actor.getUserLevel(game.user);
  return ownerLevel >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
}

export function isMinisheetVisible() {
  return game.settings.get(MODULE_ID, "minisheetVisible");
}

export function setMinisheetVisible(value) {
  game.settings.set(MODULE_ID, "minisheetVisible", !!value);
  syncPinnedMinisheet();
}

export function getPinnedActorUuid() {
  return game.settings.get(MODULE_ID, "minisheetPinnedActor");
}

export function setPinnedActorUuid(uuid) {
  game.settings.set(MODULE_ID, "minisheetPinnedActor", uuid ?? "");
}

/** All character/companion actors the current user owns — the full pin candidate pool. */
export function getPinnableActors() {
  return game.actors.filter((actor) => PINNABLE_TYPES.includes(actor.type) && hasOwnerLevel(actor));
}

/** The single owned character/companion actor behind exactly one controlled token, if any. */
export function resolveTokenControlledActor() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) return null;

  const actor = controlled[0].actor;
  if (!actor || !PINNABLE_TYPES.includes(actor.type)) return null;
  if (!hasOwnerLevel(actor)) return null;

  return actor;
}

function resolvePinnedActor(actors) {
  if (!actors.length) return null;

  const storedUuid = getPinnedActorUuid();
  const stored = storedUuid ? actors.find((actor) => actor.uuid === storedUuid) : null;
  if (stored) return stored;

  const assigned = game.user.character;
  if (assigned && actors.includes(assigned)) return assigned;

  return actors[0];
}

/**
 * Context for the minisheet's own actor-picker overlay: shown only when
 * displaying via the pin fallback (no single owned token controlling it) and
 * more than one pinnable actor exists — a lone owned character/companion
 * just gets used directly, no picker needed.
 */
export function buildActorPickerContext(currentActor) {
  if (resolveTokenControlledActor()) return { show: false, actors: [] };

  const actors = getPinnableActors();
  if (actors.length <= 1) return { show: false, actors: [] };

  return {
    show: true,
    actors: actors.map((actor) => ({
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img,
      active: actor === currentActor,
    })),
  };
}

export function syncPinnedMinisheet() {
  if (game.system.id !== "daggerheart") return;
  if (!game.settings.get(MODULE_ID, "enableMinisheet")) return;

  if (!isMinisheetVisible()) {
    teardownCharacterMiniSheet();
    teardownCompanionMiniSheet();
    return;
  }

  const actor = resolveTokenControlledActor() ?? resolvePinnedActor(getPinnableActors());

  if (!actor) {
    teardownCharacterMiniSheet();
    teardownCompanionMiniSheet();
    return;
  }

  if (actor.type === "character") {
    teardownCompanionMiniSheet();
    showCharacterMiniSheetActor(actor);
  } else {
    teardownCharacterMiniSheet();
    showCompanionMiniSheetActor(actor);
  }
}

export function selectPinnedActor(uuid) {
  setPinnedActorUuid(uuid);
  syncPinnedMinisheet();
}

/**
 * Registers this coordinator's hooks. Called at `init` (not `ready`, unlike
 * the other register* calls in main.js) specifically so the
 * `getSceneControlButtons` listener below is in place before Foundry's
 * SceneControls application does its one-time-only first render (per its
 * own doc comment, `getSceneControlButtons` fires exactly once and the
 * result is cached — registering any later risks missing that window). The
 * other hooks registered here are just as safe to add this early: they only
 * take effect once real gameplay events fire, long after `ready`. The
 * initial display sync (showing a pinned actor with no token controlled, on
 * first load) still has to wait for `ready` though — see
 * `main.js`'s trailing `syncPinnedMinisheet()` call.
 */
export function registerMinisheetPin() {
  if (game.system.id !== "daggerheart") return;
  if (!game.settings.get(MODULE_ID, "enableMinisheet")) return;

  Hooks.on("controlToken", () => syncPinnedMinisheet());
  Hooks.on("createActor", () => syncPinnedMinisheet());
  Hooks.on("deleteActor", () => syncPinnedMinisheet());
  Hooks.on("updateUser", (user) => {
    if (user.id === game.user.id) syncPinnedMinisheet();
  });

  // Closes the actor-picker overlay on an outside click — registered once
  // here rather than per-render in attachActorPickerListeners, since
  // document-level listeners bound on every render would stack forever.
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".minisheet-actor-picker.open").forEach((picker) => {
      if (!picker.contains(event.target)) picker.classList.remove("open");
    });
  });

  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    tokenControls.tools.minisheetToggle = {
      name: "minisheetToggle",
      order: 5,
      title: "Toggle Mini Sheet",
      icon: "fa-solid fa-id-card",
      toggle: true,
      active: isMinisheetVisible(),
      onChange: (_event, active) => setMinisheetVisible(active),
    };
  });
}
