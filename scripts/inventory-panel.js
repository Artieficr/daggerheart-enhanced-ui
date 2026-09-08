/**
 * Inventory panel — the "actual tabletop cards stay cards, everything else
 * is just inventory" companion to card-hand.js. Weapons/armor/consumables/
 * loot used to render as cards inside the Hand (a leftover from before that
 * distinction was drawn); they live here instead now, using sleek-ui's own
 * existing compact-row card partials (card-weapon.hbs/card-armor.hbs/
 * card-item.hbs) and listener machinery (attachFavoritesListeners) rather
 * than the Card Hand's big-card visuals — these were never meant to look
 * like playing cards, so there's no reason to build a second rendering path
 * for them.
 */
import { formatWeaponDamageDisplay, resolveUnarmedAttack } from "./helpers.js";
import { attachFavoritesListeners } from "./sheets/minisheets/utils-minisheet.js";

const MODULE_ID = "daggerheart-sleek-ui";

export function registerInventorySettings() {
  // Deliberately config:false — exposed as an on-the-fly popover next to the
  // Inventory button (see renderInventoryFilterPopover), same pattern the
  // Hand's own filter used to follow before it was removed (no filter
  // needed there once weapons/consumables moved here).
  game.settings.register(MODULE_ID, "inventoryShowWeapons", {
    name: "Inventory: Show Weapons",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "inventoryShowArmor", {
    name: "Inventory: Show Armor",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "inventoryShowConsumables", {
    name: "Inventory: Show Consumables",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "inventoryShowItems", {
    name: "Inventory: Show Items",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "inventoryFilterEquippedOnly", {
    name: "Inventory: Equipped Only",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  // Not a user-facing toggle — mirrors card-hand.js's cardHandOpen: remembers
  // whether Inventory was left open so it doesn't need reopening after every
  // minisheet remount. Defaults open, same reasoning as the Hand.
  game.settings.register(MODULE_ID, "inventoryOpen", {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });
}

export function getInventoryOpenState() {
  return game.settings.get(MODULE_ID, "inventoryOpen");
}

export function setInventoryOpenState(value) {
  game.settings.set(MODULE_ID, "inventoryOpen", !!value);
}

function buildItemData(item, extra = {}) {
  return { item, tags: [], hopeCost: 0, usesData: null, enrichedDescription: "", features: [], ...extra };
}

/**
 * Reads actor.items directly rather than going through sleek-ui's own
 * (expensive) full sheet context — same performance-conscious approach
 * card-hand.js's buildHandCards uses. The tradeoff: no enrichHTML on
 * descriptions and no hope-cost/uses-data parsing (both settle to sensible
 * empty defaults, which the partials already handle via their own
 * {{#if hopeCost}}/{{#if usesData}} guards) — acceptable here since this
 * panel is meant to be a quick equipment browser, not a replacement for the
 * full sheet.
 */
function buildInventoryContext(actor) {
  const showWeapons = game.settings.get(MODULE_ID, "inventoryShowWeapons");
  const showArmor = game.settings.get(MODULE_ID, "inventoryShowArmor");
  const showConsumables = game.settings.get(MODULE_ID, "inventoryShowConsumables");
  const showItems = game.settings.get(MODULE_ID, "inventoryShowItems");
  const equippedOnly = game.settings.get(MODULE_ID, "inventoryFilterEquippedOnly");

  const items = actor.items ? Array.from(actor.items) : [];
  const rollData = actor.getRollData();

  const weapons = showWeapons
    ? items
        .filter((i) => i.type === "weapon" && (!equippedOnly || i.system.equipped !== false))
        .map((item) => buildItemData(item, { damage: formatWeaponDamageDisplay(item.system.attack, { rollData }) }))
    : [];

  const armors = showArmor
    ? items.filter((i) => i.type === "armor" && (!equippedOnly || i.system.equipped !== false)).map((item) => buildItemData(item, { marks: item.system.marks ?? null }))
    : [];

  const consumables = showConsumables ? items.filter((i) => i.type === "consumable").map((item) => buildItemData(item, { quantity: item.system.quantity ?? null })) : [];

  const lootItems = showItems ? items.filter((i) => i.type === "loot").map((item) => buildItemData(item, { quantity: item.system.quantity ?? null })) : [];

  const unarmed = resolveUnarmedAttack(actor);
  const unarmedAttack =
    showWeapons && unarmed
      ? buildItemData(
          {
            name: game.i18n.localize(unarmed.name || "DAGGERHEART.GENERAL.unarmedAttack"),
            img: unarmed.img,
            uuid: "unarmed-attack",
            type: "weapon",
            system: { actions: new Map([[unarmed._id, unarmed]]), attack: unarmed },
          },
          { damage: formatWeaponDamageDisplay(unarmed, { rollData }) },
        )
      : null;

  return {
    document: actor,
    actor,
    ownershipLevel: game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : actor.getUserLevel(game.user),
    showTooltip: game.settings.get(MODULE_ID, "showTooltip"),
    isMinisheet: true,
    isCharacterSheet: true,
    weapons,
    armors,
    consumables,
    items: lootItems,
    unarmedAttack,
  };
}

export async function renderInventoryWindow(minisheetElement, actor) {
  if (!minisheetElement || !actor) return;
  if (game.settings.get(MODULE_ID, "favoritesDisplayMode") !== "standard") return;

  const invWindow = minisheetElement.querySelector(".inventory-window");
  if (!invWindow) return;

  const scrollTop = invWindow.querySelector(".favorites")?.scrollTop ?? 0;

  const context = buildInventoryContext(actor);
  const html = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-sleek-ui/templates/sheets/characters/main/inventory.hbs", context);
  invWindow.innerHTML = html;

  const newList = invWindow.querySelector(".favorites");
  if (newList) newList.scrollTop = scrollTop;

  attachFavoritesListeners(invWindow, actor, { isMinisheet: true });
}

const INVENTORY_FILTER_TOGGLES = [
  { key: "inventoryShowWeapons", label: "Weapons" },
  { key: "inventoryShowArmor", label: "Armor" },
  { key: "inventoryShowConsumables", label: "Consumables" },
  { key: "inventoryShowItems", label: "Items" },
];

/** Same on-the-fly popover pattern the Hand's own filter used before it was removed. */
export function renderInventoryFilterPopover(popoverEl, minisheetElement, actor) {
  if (!popoverEl) return;

  const rows = INVENTORY_FILTER_TOGGLES.map(({ key, label }) => {
    const checked = game.settings.get(MODULE_ID, key) ? "checked" : "";
    return `<label><input type="checkbox" data-setting="${key}" ${checked}> ${label}</label>`;
  }).join("");

  const equippedChecked = game.settings.get(MODULE_ID, "inventoryFilterEquippedOnly") ? "checked" : "";

  popoverEl.innerHTML = `
    ${rows}
    <hr>
    <label><input type="checkbox" data-setting="inventoryFilterEquippedOnly" ${equippedChecked}> Equipped only</label>
  `;

  popoverEl.querySelectorAll("input[data-setting]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      event.stopPropagation();
      await game.settings.set(MODULE_ID, input.dataset.setting, input.checked);
      renderInventoryWindow(minisheetElement, actor);
    });
  });
}
