// Effect resource trackers — while an active effect is running on the actor,
// the feature/item that granted it can carry its own tracker (the system's
// `system.resource`: a `die` like Unstoppable's d4 that a player turns up
// over their turns, a `diceValue` pool of rolled dice, or a `simple`
// counter). Normally that tracker only lives on the full sheet's feature row;
// this surfaces it on the character minisheet for as long as the effect is
// active, stacked down the portrait's left edge from its top-left corner.
//
// Click/right-click behavior mirrors the system's own sheet actions
// (advanceResourceDie/lowerResourceDie, toggleResourceDice/handleResourceDice
// in daggerheart.js) rather than this module's full-sheet res-die.hbs
// listeners, which wrap a die back to 0 past its max — the system caps it
// instead, and "exceeding the max" is the player's cue to drop the die
// (Unstoppable's own rules text), not something to automate.

const RESOURCE_TYPES = new Set(["die", "diceValue", "simple"]);

const DIE_ICON_ROOT = "systems/daggerheart/assets/icons/dice/hope";

/**
 * The Item an active effect came from, or null. Covers both ways an effect
 * gets onto an actor: transferred straight off an owned item (parent is the
 * Item), or applied by an action — the system's applyEffect copies the
 * item's ActiveEffect onto the actor with `origin` set to that *effect's*
 * uuid, so an origin resolving to an ActiveEffect means "its parent item".
 */
function resolveEffectSourceItem(effect) {
  if (effect.parent instanceof Item) return effect.parent;
  if (!effect.origin) return null;
  let doc = null;
  try {
    doc = foundry.utils.fromUuidSync(effect.origin);
  } catch {
    return null;
  }
  if (doc instanceof ActiveEffect) doc = doc.parent;
  return doc instanceof Item ? doc : null;
}

/** Items with their own resource tracker whose granted effect is currently active on `actor`, deduplicated, in effect order. */
function getActiveEffectResourceItems(actor) {
  const items = new Map();
  for (const effect of actor.allApplicableEffects()) {
    if (!(effect.active ?? !effect.disabled)) continue;
    const item = resolveEffectSourceItem(effect);
    if (!item || items.has(item.uuid)) continue;
    if (!RESOURCE_TYPES.has(item.system?.resource?.type)) continue;
    items.set(item.uuid, item);
  }
  return [...items.values()];
}

/** A resource's `max` can be a formula (e.g. "@prof") — parsed the same way the system's own item-resource.hbs does, via its rollParsed helper. */
function parseResourceMax(item) {
  const max = item.system.resource.max;
  const rollParsed = Handlebars.helpers.rollParsed;
  if (typeof rollParsed === "function") return rollParsed(max, item.actor, item, true);
  return Number(max) || 0;
}

function dieFacesOf(resource) {
  return Number(String(resource.dieFaces ?? "d6").replace("d", "")) || 6;
}

function renderTracker(item) {
  const resource = item.system.resource;
  const name = foundry.utils.escapeHTML(item.name);
  const faces = foundry.utils.escapeHTML(resource.dieFaces ?? "d6");

  if (resource.type === "die") {
    const value = resource.value || "";
    return `
      <a class="effect-resource die" data-item-uuid="${item.uuid}" data-tooltip="${name} (${faces})<br>Click +1 · Right-click −1">
        <img src="${DIE_ICON_ROOT}/${faces}.svg" alt="${faces}">
        <span class="effect-resource-value">${value}</span>
      </a>`;
  }

  if (resource.type === "diceValue") {
    const count = parseResourceMax(item);
    const dice = Array.from({ length: count }, (_, index) => {
      const state = resource.diceStates?.[index];
      return `
        <a class="effect-resource-die-value ${state?.used ? "used" : ""}" data-dice="${index}">
          <img src="${DIE_ICON_ROOT}/${faces}.svg" alt="${faces}">
          <span class="effect-resource-value">${state?.value ?? "?"}</span>
        </a>`;
    }).join("");
    return `
      <div class="effect-resource dice-value" data-item-uuid="${item.uuid}" data-tooltip="${name}<br>Click a die to mark it used · Right-click to reroll">
        ${dice}
      </div>`;
  }

  const icon = foundry.utils.escapeHTML(resource.icon || "fa-solid fa-hashtag");
  return `
    <a class="effect-resource simple" data-item-uuid="${item.uuid}" data-tooltip="${name}<br>Click +1 · Right-click −1">
      <i class="${icon}"></i>
      <span class="effect-resource-value">${resource.value ?? 0}/${parseResourceMax(item)}</span>
    </a>`;
}

async function updateDie(item, delta) {
  const value = (item.system.resource.value || 0) + delta;
  await item.update({ "system.resource.value": Math.max(0, Math.min(value, dieFacesOf(item.system.resource))) });
}

async function updateSimple(item, delta) {
  const value = (item.system.resource.value || 0) + delta;
  await item.update({ "system.resource.value": Math.max(0, Math.min(value, parseResourceMax(item))) });
}

async function toggleDiceValue(item, index) {
  const state = item.system.resource.diceStates?.[index];
  await item.update({ [`system.resource.diceStates.${index}.used`]: state ? !state.used : true });
}

async function rerollDiceValue(item) {
  const rollValues = await game.system.api.applications.dialogs.ResourceDiceDialog?.create(item, item.actor);
  if (!rollValues) return;
  await item.update({
    "system.resource.diceStates": rollValues.reduce((acc, state, index) => {
      acc[index] = { value: state.value, used: state.used };
      return acc;
    }, {}),
  });
}

function attachTrackerListeners(container) {
  container.querySelectorAll(".effect-resource").forEach((el) => {
    const item = foundry.utils.fromUuidSync(el.dataset.itemUuid);
    if (!item?.isOwner) {
      el.classList.add("readonly");
      return;
    }

    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (item.system.resource.type === "die") updateDie(item, 1);
      else if (item.system.resource.type === "simple") updateSimple(item, 1);
      else {
        const die = event.target.closest(".effect-resource-die-value");
        if (die) toggleDiceValue(item, die.dataset.dice);
      }
    });

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (item.system.resource.type === "die") updateDie(item, -1);
      else if (item.system.resource.type === "simple") updateSimple(item, -1);
      else rerollDiceValue(item);
    });
  });
}

/**
 * (Re)renders the tracker column for `actor` into `minisheetElement`'s
 * `.effect-resources` container. Cheap enough to call on every render and
 * every owned-item update — the resource value lives on the item, so an
 * item update (not an effect update) is what changes the number shown.
 */
export function renderEffectResources(minisheetElement, actor) {
  const container = minisheetElement?.querySelector(".effect-resources");
  if (!container || !actor) return;
  const items = getActiveEffectResourceItems(actor);
  container.innerHTML = items.map(renderTracker).join("");
  container.hidden = !items.length;
  attachTrackerListeners(container);
}
