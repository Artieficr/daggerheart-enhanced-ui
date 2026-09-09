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

const MODULE_ID = "daggerheart-enhanced-ui";
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

export function getFavoriteActorUuids() {
  return game.settings.get(MODULE_ID, "minisheetPinnedFavorites");
}

export function isFavoriteActor(uuid) {
  return getFavoriteActorUuids().includes(uuid);
}

export function setFavoriteActor(uuid, value) {
  const favorites = getFavoriteActorUuids();
  const isFavorite = favorites.includes(uuid);
  if (value === isFavorite) return;
  const next = value ? [...favorites, uuid] : favorites.filter((id) => id !== uuid);
  game.settings.set(MODULE_ID, "minisheetPinnedFavorites", next);
}

/**
 * Drops any favorited uuid whose actor no longer exists (deleted while this
 * client wasn't connected to catch the deleteActor hook in
 * registerMinisheetPin — that hook prunes eagerly for the common case, this
 * is the fallback for the rest). Cheap and silent: fromUuidSync resolves
 * world/embedded documents already loaded client-side with no async round
 * trip, and this only ever runs on-demand (opening the favorites view), not
 * on every render. A stale entry is already invisible either way — nothing
 * downstream renders a uuid that isn't in getPinnableActors() — so this is
 * purely storage upkeep, never something a viewer would notice happen.
 */
export function pruneStaleFavorites() {
  const favorites = getFavoriteActorUuids();
  const next = favorites.filter((uuid) => fromUuidSync(uuid));
  if (next.length === favorites.length) return;
  game.settings.set(MODULE_ID, "minisheetPinnedFavorites", next);
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
 * just gets used directly, no picker needed. `showExtras` (search box, the
 * per-row favorite star, and the favorites-only view) only kicks in past 5
 * actors — mainly a GM convenience, since a player is rarely juggling that
 * many owned actors.
 */
export function buildActorPickerContext(currentActor) {
  if (resolveTokenControlledActor()) return { show: false, actors: [], showExtras: false };

  const actors = getPinnableActors();
  if (actors.length <= 1) return { show: false, actors: [], showExtras: false };

  const favorites = getFavoriteActorUuids();

  return {
    show: true,
    showExtras: actors.length > 5,
    actors: actors.map((actor) => ({
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img,
      active: actor === currentActor,
      favorite: favorites.includes(actor.uuid),
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

  // The pin fallback only applies with NOTHING selected at all — if exactly
  // one token of some other type (adversary/environment/party/anything not
  // pinnable) is controlled, that token's own minisheet class handles
  // showing itself (each requires its own single-token-of-its-type match,
  // same as this one), and the pinned character/companion sheet needs to
  // get out of the way instead of fighting it for the same screen space.
  // Multi-select (2+ controlled tokens) falls into this same "don't
  // fall back" case, matching how every other minisheet type already
  // shows nothing for an ambiguous multi-select.
  const controlled = canvas.tokens?.controlled ?? [];
  const actor = resolveTokenControlledActor() ?? (controlled.length === 0 ? resolvePinnedActor(getPinnableActors()) : null);

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
  Hooks.on("deleteActor", (actor) => {
    // Both settings store bare uuids with no reconciliation against
    // game.actors — a deleted actor otherwise leaves a stale entry behind
    // forever (harmless functionally, since nothing downstream matches a
    // uuid that isn't in getPinnableActors() any more, but it's unbounded
    // cruft in client storage over a long campaign). Prune eagerly instead
    // of waiting for a read-time reconciliation that was never written.
    if (getPinnedActorUuid() === actor.uuid) setPinnedActorUuid("");
    setFavoriteActor(actor.uuid, false);
    syncPinnedMinisheet();
  });
  Hooks.on("updateUser", (user) => {
    if (user.id === game.user.id) syncPinnedMinisheet();
  });

  // Closes the actor-picker overlay on an outside click — registered once
  // here rather than per-render in attachActorPickerListeners, since
  // document-level listeners bound on every render would stack forever. The
  // favorites-only right-click context menu (utils-minisheet.js) is
  // appended to document.body rather than nested inside the picker — it has
  // to escape the minisheet's own scale transform to position itself at the
  // real cursor coordinates — so a click on it must not count as "outside".
  document.addEventListener("click", (event) => {
    if (event.target.closest(".minisheet-actor-picker-contextmenu")) return;
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
