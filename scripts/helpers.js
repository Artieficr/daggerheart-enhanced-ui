// ─── TEMPLATES ───────────────────────────────────────────────────────────────

export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Character templates
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/sheet-main.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/sheet-sidebar.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/main/header.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/main/tabs.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/main/favorites.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/main/inventory.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/tabs/features.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/tabs/loadout.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/tabs/inventory.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/tabs/effects.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/tabs/biography.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/characters/minisheet.hbs",
    // Companion templates
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/companion-sheet-main.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/main/companion-header.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/main/companion-tabs.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/tabs/companion-details.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/tabs/companion-effects.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-companion-partner.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/companions/companion-minisheet.hbs",
    // Party templates
    "modules/daggerheart-enhanced-ui/templates/sheets/party/party-sheet-main.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/main/party-header.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/main/party-tabs.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/tabs/party-members.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/tabs/party-inventory.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/tabs/party-notes.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-party-character.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/party-minisheet.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/party/party-overview.hbs",
    "modules/daggerheart-enhanced-ui/templates/countdown-tracker.hbs",
    // Adversary templates
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/adversary-sheet-main.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/adversary-sheet-sidebar.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/main/adversary-header.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/main/adversary-tabs.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/tabs/adversary-features.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/tabs/adversary-effects.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/tabs/adversary-notes.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/adversaries/adversary-minisheet.hbs",
    // Environment templates
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/environment-sheet-main.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/main/environment-header.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/main/environment-tabs.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/tabs/environment-features.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/tabs/environment-adversaries.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/tabs/environment-notes.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/environment-minisheet.hbs",
    "modules/daggerheart-enhanced-ui/templates/sheets/environments/environment-minisheet-scene.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-environment-adversaries.hbs",
    // Shared components
    "modules/daggerheart-enhanced-ui/templates/components/tabs-floating.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/tabs-basic.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/currency.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-features.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-domains.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-weapon.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-armor.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-item.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-effects.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-companion-effects.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/effects-bar.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/effects-panel.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-actor-attack.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/card-npc-features.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/compact-card-weapon.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/compact-card-armor.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/compact-card-domains.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/compact-card-features.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/compact-card-item.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/divider.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/minisheet-actor-picker.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-dice.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-die.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-hope.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-recall.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-simple.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-uses.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-quantity.hbs",
    "modules/daggerheart-enhanced-ui/templates/components/res-fear.hbs",
  ];
  return loadTemplates(templatePaths);
}

// ─── RESOURCE MANAGEMENT ─────────────────────────────────────────────────────

function _getResourceTooltipPosition(target) {
  const pad = game.tooltip.constructor.TOOLTIP_MARGIN_PX ?? 5;
  const anchor = target.getBoundingClientRect();

  return {
    top: `${anchor.bottom + pad}px`,
    left: `${anchor.left}px`,
    bottom: "",
    right: "",
  };
}

export async function toggleResourceManagement(event, button, actor) {
  event.preventDefault();
  event.stopPropagation();

  if (document.body.querySelector(".locked-tooltip .resource-management-container")) {
    game.tooltip.dismissLockedTooltips();
    return;
  }

  const resources = Object.entries(actor.system.availableExtraResources).reduce((acc, [key, resource]) => {
    const resourceData = actor.system.resources[key];
    if (!resourceData) return acc;

    acc[key] = {
      id: key,
      label: game.i18n.localize(resource.label),
      value: resourceData.value,
      max: resourceData.max,
      fullIcon: resource.images?.full ?? { value: "fa-solid fa-circle", isIcon: true },
      emptyIcon: resource.images?.empty ?? { value: "fa-regular fa-circle", isIcon: true },
    };

    return acc;
  }, {});

  if (!Object.keys(resources).length) return;

  const htmlContent = await foundry.applications.handlebars.renderTemplate(
    "systems/daggerheart/templates/ui/tooltip/resourceManagement.hbs",
    { resources },
  );

  const target = button.closest(".resource-section");
  if (!target) return;

  const resourceManager = target.querySelector(".resource-manager");
  const position = _getResourceTooltipPosition(target);

  game.tooltip.deactivate();
  game.tooltip.dismissLockedTooltips();

  const lockedTooltip = game.tooltip.createLockedTooltip(position, htmlContent, {
    cssClass: "bordered-tooltip dh-style",
  });

  resourceManager?.classList.add("inverted");

  Hooks.once(CONFIG.DH.HOOKS.hooksConfig.lockedTooltipDismissed, () => {
    resourceManager?.classList.remove("inverted");
  });

  lockedTooltip.querySelectorAll(".resource-value").forEach((element) => {
    element.addEventListener("click", async (clickEvent) => {
      const pip = clickEvent.target.closest(".resource-value");
      if (!pip) return;

      const { resource, value: textValue } = pip.dataset;
      const inputValue = Number.parseInt(textValue);
      const decreasing = inputValue <= actor.system.resources[resource].value;
      const value = decreasing ? inputValue - 1 : inputValue;

      await actor.update({ [`system.resources.${resource}.value`]: value }, { render: false });

      const section = pip.closest(".resource-section");
      for (const pipEl of section.querySelectorAll(".resource-value")) {
        const showFull = Number.parseInt(pipEl.dataset.value) <= value;
        pipEl.querySelector(".full")?.classList.toggle("hidden", !showFull);
        pipEl.querySelector(".empty")?.classList.toggle("hidden", showFull);
      }
    });
  });
}

// ─── ARMOR MANAGEMENT ────────────────────────────────────────────────────────

function _armorSourceOrder(origin) {
  switch (origin?.type) {
    case "class":
    case "subclass":
    case "ancestry":
    case "community":
    case "feature":
    case "domainCard":
      return 2;
    case "loot":
    case "consumable":
      return 3;
    case "character":
      return 4;
    case "weapon":
      return 5;
    case "armor":
      return 6;
    default:
      return 1;
  }
}

function _getArmorSources(actor) {
  const rawArmorSources = Array.from(actor.allApplicableEffects()).filter((x) => x.system.armorData);
  if (actor.system.armor) rawArmorSources.push(actor.system.armor);

  const data = rawArmorSources.map((doc) => {
    const origin = doc.origin ? foundry.utils.fromUuidSync(doc.origin) : doc;
    const useParentName = doc.parent && !(doc.parent instanceof Actor) && doc.parent.type !== "armor";
    const name = doc.origin || !useParentName ? doc.name : doc.parent.name;

    return {
      origin,
      name,
      document: doc,
      data: doc.system.armor ?? doc.system.armorData,
      disabled: !!doc.disabled || !!doc.isSuppressed,
    };
  });

  return data.sort((a, b) => _armorSourceOrder(a.origin) - _armorSourceOrder(b.origin));
}

function _getArmorTooltipPosition(target, direction) {
  const pad = game.tooltip.constructor.TOOLTIP_MARGIN_PX ?? 5;
  const anchor = target.getBoundingClientRect();
  const right = `${window.innerWidth - anchor.right}px`;

  if (direction === "UP") {
    return {
      top: "",
      left: "",
      bottom: `${window.innerHeight - anchor.top + pad}px`,
      right,
    };
  }

  return {
    top: `${anchor.bottom + pad}px`,
    left: "",
    bottom: "",
    right,
  };
}

function _setArmorSlotIcon(icon, filled) {
  if (filled) {
    icon.classList.remove("fa-regular", "fa-shield-halved");
    icon.classList.add("fa-solid", "fa-shield");
  } else {
    icon.classList.remove("fa-solid", "fa-shield-halved");
    icon.classList.add("fa-regular", "fa-shield");
  }
}

function _getArmorSourceCurrent(document) {
  if (document.type === "armor") {
    return document.system.armor.current;
  }
  if (document.system.armorData) {
    return document.system.armorData.current;
  }
  return 0;
}

async function _syncArmorSlotIcons(container) {
  if (!container) return;

  const slot = container.querySelector(".armor .slot");
  if (!slot?.dataset.uuid) return;

  const document = await foundry.utils.fromUuid(slot.dataset.uuid);
  if (!document) return;

  const current = _getArmorSourceCurrent(document);

  for (const icon of container.querySelectorAll(".armor .slot i")) {
    const index = Number.parseInt(icon.dataset.index);
    _setArmorSlotIcon(icon, index < current);
  }
}

export async function toggleArmorManagement(event, button, actor) {
  event.preventDefault();
  event.stopPropagation();

  if (document.body.querySelector(".locked-tooltip .armor-management-container")) {
    game.tooltip.dismissLockedTooltips();
    return;
  }

  const target = button.closest(".resource-container");
  if (!target) return;

  const armorSources = _getArmorSources(actor)
    .filter((s) => !s.disabled)
    .toReversed()
    .map(({ name, document, data }) => ({
      ...data,
      uuid: document.uuid,
      name,
    }));

  if (!armorSources.length) return;

  const isMinisheet = !!target.closest(".minisheet");
  const direction = isMinisheet ? "UP" : "DOWN";
  const useResourcePips = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.appearance).useResourcePips;
  const htmlContent = await foundry.applications.handlebars.renderTemplate(
    "systems/daggerheart/templates/ui/tooltip/armorManagement.hbs",
    { sources: armorSources, useResourcePips },
  );

  const CharacterSheet = CONFIG.Actor.sheetClasses.character["daggerheart.CharacterSheet"]?.cls;
  const position = _getArmorTooltipPosition(target, direction);

  game.tooltip.deactivate();
  game.tooltip.dismissLockedTooltips();

  const lockedTooltip = game.tooltip.createLockedTooltip(position, htmlContent, {
    cssClass: "bordered-tooltip dh-style",
  });

  for (const slotBar of lockedTooltip.querySelectorAll(".slot-bar.armor")) {
    await _syncArmorSlotIcons(slotBar);
  }

  if (CharacterSheet?.armorSourcePipUpdate) {
    lockedTooltip.querySelectorAll(".armor .slot").forEach((element) => {
      element.addEventListener("click", async (event) => {
        await CharacterSheet.armorSourcePipUpdate(event);
        await _syncArmorSlotIcons(element.closest(".slot-bar"));
      });
    });
  }
}

// ─── TOOLTIPS ────────────────────────────────────────────────────────────────

/** Dismiss the active hover tooltip when the pointer leaves tooltip triggers. */
export function dismissHoverTooltip(event) {
  const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
  const isOverTooltipTrigger = hoveredElement?.closest("[data-tooltip], [data-tooltip-text]");
  if (!isOverTooltipTrigger && game.tooltip?.active) {
    game.tooltip.deactivate();
  }
}

// ─── DOMAIN CARDS ────────────────────────────────────────────────────────────

/**
 * Recall a domain card from vault, showing the cost dialog with a proper title.
 * @param {Item} item
 * @param {Event} event
 */
export async function recallDomainCardFromVault(item, event) {
  const sys = item?.system;
  if (!sys?.toggleVault) return;

  if (sys.recallCost === 0) {
    return sys.toggleVault(event, false);
  }

  const cls = game.system.api.models.actions.actionsTypes.effect;
  const action = new cls(
    {
      ...cls.getSourceConfig(sys),
      type: "effect",
      name: "DAGGERHEART.APPLICATIONS.ContextMenu.recall",
      chatDisplay: false,
      cost: [{ key: "stress", value: sys.recallCost }],
    },
    { parent: sys },
  );

  const config = await action.use(event);
  if (config) {
    await sys.toggleVault(event, false);
  }
}

// ─── BEASTFORM ───────────────────────────────────────────────────────────────

/** @param {Actor} actor */
export function isBeastformActive(actor) {
  return !!actor.effects?.find((x) => !x.disabled && x.type === "beastform");
}

/** @param {Actor} actor @returns {string|null} */
export function getBeastformPortrait(actor) {
  if (!game.settings.get("daggerheart-enhanced-ui", "beastformPortrait")) return null;
  if (!isBeastformActive(actor)) return null;
  return actor.prototypeToken?.ring?.subject?.texture || null;
}

// ─── UNARMED ATTACK ──────────────────────────────────────────────────────────

/** @param {Actor} actor @returns {boolean} */
export function resolveUsesUnarmed(actor) {
  const sys = actor.system;
  if (typeof sys.usesUnarmed === "boolean") return sys.usesUnarmed;
  return !!sys.usedUnarmed;
}

/** @param {Actor} actor @returns {object|null} */
export function resolveUnarmedAttack(actor) {
  const sys = actor.system;
  if (typeof sys.usesUnarmed === "boolean") {
    return sys.usesUnarmed ? sys.attack : null;
  }
  return sys.usedUnarmed ?? null;
}

// ─── WEAPON DAMAGE ───────────────────────────────────────────────────────────

/**
 * Build display HTML for a weapon/unarmed attack damage formula.
 * Supports current `damage.main` and legacy `damage.parts` schemas.
 */
export function formatWeaponDamageDisplay(attack, { rollData = {} } = {}) {
  if (!attack?.damage) return "";

  const formatTypeIcons = (typeSet) => {
    if (!typeSet) return "";
    const types = typeSet instanceof Set ? [...typeSet] : [...typeSet];
    if (!types.length) return "";
    return types
      .map((t) => {
        const icon = CONFIG.DH?.GENERAL?.damageTypes?.[t]?.icon;
        if (icon) return `<i class="fa-solid ${icon}"></i>`;
        return t === "magical" ? '<i class="fa-solid fa-wand-sparkles"></i>' : '<i class="fa-solid fa-hand-fist"></i>';
      })
      .join(" ");
  };

  const appendIcons = (formula, part) => {
    const typeIcons = formatTypeIcons(part?.type);
    return typeIcons ? `${formula}&nbsp;&nbsp;${typeIcons}` : formula;
  };

  const resolveFormula = (value) => {
    if (!value) return "";
    if (typeof value.getFormula === "function") {
      return Roll.replaceFormulaData(value.getFormula(), rollData);
    }
    if (value.custom?.enabled) {
      const formula = value.custom.formula ?? game.i18n.localize("DAGGERHEART.GENERAL.custom");
      return formula.includes("@") ? Roll.replaceFormulaData(formula, rollData) : formula;
    }
    return "";
  };

  const mainPart = attack.damage.main;
  if (mainPart) {
    const formula =
      typeof attack.getDamageFormula === "function" ? attack.getDamageFormula() : resolveFormula(mainPart.value);
    if (formula) return appendIcons(formula, mainPart);
  }

  const damageParts = attack.damage.parts;
  if (damageParts && !foundry.utils.isEmpty(damageParts)) {
    return Object.values(damageParts)
      .map((part) => appendIcons(resolveFormula(part.value), part))
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

// ─── RESOURCE PIPS ───────────────────────────────────────────────────────────

/**
 * Shared handler for a resource header's click (+1) / right-click (-1) —
 * [data-action="modifyResource"] in every full sheet and minisheet template
 * (see CLAUDE.md's "Known duplication" for who calls this).
 *
 * The two armor branches only ever match for a character actor —
 * "system.armorScore.value" and "system.armor.system.armor.current" are
 * character-specific dot-paths no other actor type's template ever sets as
 * data-resource — so calling this unconditionally for companion/adversary
 * actors is safe; their own resource paths just fall through to the last,
 * generic branch.
 */
export async function modifyActorResource(event, actor, target) {
  event.preventDefault();
  const resource = target.dataset.resource;
  let amount = parseInt(target.dataset.amount);
  if (event.type === "contextmenu") amount = -amount;

  if (resource === "system.armorScore.value") {
    await actor.system.updateArmorValue({ value: amount });
  } else if (resource === "system.armor.system.armor.current") {
    // Backwards-compat branch — an older schema's dot-path.
    const armorItem = actor.items.get(actor.system.armor._id);
    if (!armorItem) return;
    const currentValue = armorItem.system.armor.current;
    const maxValue = actor.system.armorScore;
    const newValue = Math.max(0, Math.min(maxValue, currentValue + amount));
    await armorItem.update({ "system.armor.current": newValue });
  } else {
    const currentValue = foundry.utils.getProperty(actor, resource);
    const maxPath = resource.replace(".value", ".max");
    const maxValue = foundry.utils.getProperty(actor, maxPath);
    const newValue = Math.max(0, Math.min(maxValue, currentValue + amount));
    await actor.update({ [resource]: newValue });
  }
}

/** Companion piece to modifyActorResource() for a resource pip's own click (jump to this pip's value) / right-click (decrement by 1) — [data-action="toggleResource"]. Same armor special-casing, same reasoning for why it's safe to call unconditionally for any actor type. */
export async function toggleActorResource(event, actor, target) {
  const resource = target.dataset.resource;
  const clickedValue = parseInt(target.dataset.value);

  if (resource === "system.armorScore.value") {
    const currentValue = foundry.utils.getProperty(actor, "system.armorScore.value");
    const newValue = clickedValue === currentValue ? currentValue - 1 : clickedValue;
    await actor.system.updateArmorValue({ value: newValue - currentValue });
  } else if (resource === "system.armor.system.armor.current") {
    // Backwards-compat branch — an older schema's dot-path.
    const armorItem = actor.items.get(actor.system.armor._id);
    if (!armorItem) return;
    const currentValue = armorItem.system.armor.current;
    const newValue = Math.max(0, clickedValue === currentValue ? currentValue - 1 : clickedValue);
    await armorItem.update({ "system.armor.current": newValue });
  } else {
    const currentValue = foundry.utils.getProperty(actor, resource);
    const newValue = Math.max(0, clickedValue === currentValue ? currentValue - 1 : clickedValue);
    await actor.update({ [resource]: newValue });
  }
}

/** Same click-to-value/right-click-to-decrement pattern as toggleActorResource(), for the Hope resource specifically (its own dedicated markup/action rather than the generic toggleResource one). */
export async function toggleActorHope(actor, target) {
  const clickedValue = parseInt(target.dataset.value);
  const currentHope = actor.system.resources.hope.value;
  const newHope = Math.max(0, clickedValue === currentHope ? currentHope - 1 : clickedValue);
  await actor.update({ "system.resources.hope.value": newHope });
}

/** The Hope header label itself also responds to click (+1) / right-click (-1), independent of clicking a specific pip — shared by the full character sheet and every minisheet template that shows Hope. */
export function attachHopeLabelListener(element, actor) {
  const hopeLabel = element.querySelector(".hope-container h3");
  if (!hopeLabel) return;

  hopeLabel.addEventListener("click", async () => {
    const current = actor.system.resources.hope.value;
    const max = actor.system.resources.hope.max;
    if (current < max) await actor.update({ "system.resources.hope.value": current + 1 });
  });
  hopeLabel.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    const current = actor.system.resources.hope.value;
    if (current > 0) await actor.update({ "system.resources.hope.value": current - 1 });
  });
}

/**
 * Click (-1) / right-click (+1) for a feature/item action's own "uses"
 * tracker (action.uses.value/.max) — distinct from an item's own
 * system.resource (below), which tracks a different kind of per-item
 * resource. Shared by every full sheet's inventory/features tab and every
 * minisheet's card listeners.
 */
export function attachUsesResourceListeners(element) {
  element.querySelectorAll(".uses-resource").forEach((el) => {
    el.addEventListener("click", async () => {
      const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
      const actionId = el.dataset.actionId;
      if (!itemUuid || !actionId) return;
      const item = await fromUuid(itemUuid);
      const action = item?.system.actions?.get(actionId);
      if (!action?.uses) return;
      await action.update({ "uses.value": Math.max(0, action.uses.value - 1) });
    });
    el.addEventListener(
      "contextmenu",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
        const actionId = el.dataset.actionId;
        if (!itemUuid || !actionId) return;
        const item = await fromUuid(itemUuid);
        const action = item?.system.actions?.get(actionId);
        if (!action?.uses) return;
        await action.update({ "uses.value": Math.min(action.uses.max, action.uses.value + 1) });
      },
      true,
    );
  });
}

/** Click (+1) / right-click (-1) for an item's own simple (non-die) system.resource.value. */
export function attachSimpleResourceListeners(element) {
  element.querySelectorAll(".simple-resource").forEach((el) => {
    el.addEventListener("click", async () => {
      const itemUuid = el.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const maxValue = parseInt(el.dataset.max) || 0;
      await item.update({ "system.resource.value": Math.min(maxValue, (item.system.resource.value || 0) + 1) });
    });
    el.addEventListener(
      "contextmenu",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const itemUuid = el.dataset.itemUuid;
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;
        await item.update({ "system.resource.value": Math.max(0, (item.system.resource.value || 0) - 1) });
      },
      true,
    );
  });
}

/** Click (+1, wrapping back to 0 past the die's face count) / right-click (-1) for an item's own die-type system.resource.value. */
export function attachDieResourceListeners(element) {
  element.querySelectorAll(".die-resource").forEach((el) => {
    el.addEventListener("click", async () => {
      const itemUuid = el.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const dieFaces = parseInt(el.dataset.dieFaces?.replace("d", "")) || 6;
      await item.update({ "system.resource.value": ((item.system.resource.value || 0) + 1) % (dieFaces + 1) });
    });
    el.addEventListener(
      "contextmenu",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const itemUuid = el.dataset.itemUuid;
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;
        await item.update({ "system.resource.value": Math.max(0, (item.system.resource.value || 0) - 1) });
      },
      true,
    );
  });
}

// ─── ACTIVE EFFECTS ──────────────────────────────────────────────────────────

const EFFECT_SOURCE_TYPE_LABELS = {
  feature: "Feature",
  domainCard: "Domain Card",
  weapon: "Weapon",
  armor: "Armor",
  consumable: "Consumable",
  loot: "Loot",
  character: "Character",
  companion: "Companion",
  adversary: "Adversary",
};

/**
 * Shapes an actor's active effects into card-ready data (source/status tags,
 * enriched description), split into active/inactive. Shared by
 * character-sheet.js/companion-sheet.js/adversary-sheet.js's own
 * `_prepareEffectsData` methods and by effects-panel.js for the minisheet
 * Effects & Conditions bar/panel. `EFFECT_SOURCE_TYPE_LABELS` above must
 * cover every item/actor type an effect's source can resolve to across all
 * three full sheets, since this one function now serves all of them.
 */
export async function prepareActorEffectsData(actor) {
  const createEffectData = async (effect) => {
    const infoTags = [];
    const resourceTags = [];
    let sourceItem = null;

    if (effect.origin) sourceItem = await fromUuid(effect.origin);
    if (!sourceItem && effect.parent) sourceItem = effect.parent;

    if (sourceItem) {
      const sourceTypeName = EFFECT_SOURCE_TYPE_LABELS[sourceItem.type] || "Unknown";
      infoTags.push({
        label: `${sourceTypeName}: ${sourceItem.name}`,
        uuid: sourceItem.uuid,
        tagClass: "tag-green",
      });
    }

    if (effect.statuses && effect.statuses.size > 0) {
      effect.statuses.forEach((status) => {
        resourceTags.push({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          uuid: "",
          tagClass: "tag-blue",
        });
      });
    }

    const isTemporary = effect.isTemporary || effect.duration?.rounds != null || (effect.duration?.seconds != null && effect.duration.seconds > 0) || effect.duration?.turns != null;

    resourceTags.push({
      label: isTemporary ? "Temporary" : "Passive",
      uuid: "",
      tagClass: "tag-blue",
    });

    let description = effect.description;
    if (description && /^[A-Z][A-Z_]+\./.test(description)) {
      description = game.i18n.localize(description);
    }
    const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(description, {
      relativeTo: effect,
    });

    return { item: effect, infoTags, resourceTags, enrichedDescription };
  };

  const allEffects = Array.from(actor.allApplicableEffects());
  const activeEffects = allEffects.filter((e) => !e.disabled);
  const inactiveEffects = allEffects.filter((e) => e.disabled);

  return {
    activeEffects: await Promise.all(activeEffects.map(createEffectData)),
    inactiveEffects: await Promise.all(inactiveEffects.map(createEffectData)),
  };
}

/** True when a prepareActorEffectsData() entry is a status/condition (e.g. "Stunned") rather than a plain feature-driven effect. */
export function isStatusEffectData(effectData) {
  return !!(effectData.item.statuses && effectData.item.statuses.size > 0);
}

// ─── GM NOTES ────────────────────────────────────────────────────────────────

/**
 * Enriched HTML for an item's GM-only notes field (system.gmNotes — every
 * item type has one, see the daggerheart system's own tab-description.hbs),
 * or "" if there's nothing to show or the current user isn't a GM. Returning
 * "" rather than gating in the template means a non-GM never has GM notes
 * enriched or handed to them in the first place, not just hidden by CSS.
 */
export async function enrichGMNotes(item) {
  if (!game.user.isGM || !item.system.gmNotes) return "";
  return foundry.applications.ux.TextEditor.enrichHTML(item.system.gmNotes, { relativeTo: item });
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────

/**
 * Shapes an actor's weapons/armors/consumables/loot into the row data the
 * inventory partials expect (hope cost, uses tracking, enriched description,
 * tags, weapon/armor feature lookups against homebrew overrides). Shared by
 * every full sheet that renders a real inventory tab (character, party);
 * caller-specific extras (the character sheet's synthetic unarmed-attack row,
 * the Hotpot ingredient tab) are layered on by the caller afterward, not here.
 */
export async function prepareActorInventoryData(actor) {
  const createBaseData = async (item) => {
    let hopeCost = 0;
    let usesData = null;

    if (item.system.actions) {
      for (const action of [...item.system.actions]) {
        if (action.cost) {
          for (const cost of action.cost) {
            if (cost.key === "hope") hopeCost = Math.max(hopeCost, cost.value);
          }
        }
        if (action.uses && action.uses.max && !usesData) {
          const max = parseInt(action.uses.max);
          usesData = { current: action.uses.value, max, remaining: max - action.uses.value, recovery: action.uses.recovery, actionId: action._id };
        }
      }
    }

    const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(item.system.description, { relativeTo: item });
    return { hopeCost, usesData, enrichedDescription };
  };

  const createWeaponData = async (item) => {
    const base = await createBaseData(item);
    const attack = item.system.attack;
    const rollData = item.getRollData?.() ?? {};
    const damage = formatWeaponDamageDisplay(attack, { rollData });

    const homebrewWeaponFeatures = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Homebrew)?.itemFeatures?.weaponFeatures ?? {};
    const allWeaponFeatures = { ...CONFIG.DH.ITEM.weaponFeatures, ...homebrewWeaponFeatures };
    const homebrewWeaponKeys = new Set(Object.keys(homebrewWeaponFeatures));
    const features = (item.system.weaponFeatures || []).flatMap((wf) => {
      const config = allWeaponFeatures[wf.value];
      if (!config) return [];
      const isHomebrew = homebrewWeaponKeys.has(wf.value);
      return [
        {
          name: game.i18n.localize(config.label ?? config.name),
          description: isHomebrew ? (config.description ?? "") : game.i18n.localize(config.description),
        },
      ];
    });

    const tags = [
      {
        label: item.system.secondary ? game.i18n.localize("DAGGERHEART.ITEMS.Weapon.secondaryWeapon.full") : game.i18n.localize("DAGGERHEART.ITEMS.Weapon.primaryWeapon.full"),
        tagClass: "tag-green",
      },
      {
        label: attack?.roll?.trait ? attack.roll.trait.charAt(0).toUpperCase() + attack.roll.trait.slice(1) : "",
        tagClass: "tag-blue",
      },
      {
        label: game.i18n.localize(`DAGGERHEART.CONFIG.Range.${attack.range}.name`),
        tagClass: "tag-blue",
      },
      {
        label: game.i18n.localize(`DAGGERHEART.CONFIG.Burden.${item.system.burden}`),
        tagClass: "tag-blue",
      },
      {
        label: damage,
        tagClass: "tag-blue",
      },
    ].filter((tag) => tag.label);

    return { item, tags, features, damage, ...base };
  };

  const createArmorData = async (item) => {
    const base = await createBaseData(item);

    const homebrewArmorFeatures = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Homebrew)?.itemFeatures?.armorFeatures ?? {};
    const allArmorFeatures = { ...CONFIG.DH.ITEM.armorFeatures, ...homebrewArmorFeatures };
    const homebrewArmorKeys = new Set(Object.keys(homebrewArmorFeatures));
    const features = (item.system.armorFeatures || []).flatMap((af) => {
      const config = allArmorFeatures[af.value];
      if (!config) return [];
      const isHomebrew = homebrewArmorKeys.has(af.value);
      return [
        {
          name: game.i18n.localize(config.label ?? config.name),
          description: isHomebrew ? (config.description ?? "") : game.i18n.localize(config.description),
        },
      ];
    });

    const tags = [
      {
        label: `${game.i18n.localize("DAGGERHEART.ITEMS.Armor.baseScore")}: ${item.system.armor.max}`,
        tagClass: "tag-blue",
      },
      {
        label: `${game.i18n.localize("DAGGERHEART.ITEMS.Armor.baseThresholds.base")}: ${item.system.baseThresholds.major} / ${item.system.baseThresholds.severe}`,
        tagClass: "tag-blue",
      },
    ];

    return { item, tags, marks: item.system.armor, features, ...base };
  };

  const createConsumableData = async (item) => {
    const base = await createBaseData(item);
    return { item, tags: [], quantity: item.system.quantity, ...base };
  };

  const createLootData = async (item) => {
    const base = await createBaseData(item);
    return { item, tags: [], quantity: item.system.quantity, ...base };
  };

  const weapons = actor.items.filter((i) => i.type === "weapon").sort((a, b) => a.sort - b.sort);
  const armors = actor.items.filter((i) => i.type === "armor").sort((a, b) => a.sort - b.sort);
  const consumables = actor.items.filter((i) => i.type === "consumable").sort((a, b) => a.sort - b.sort);
  const loots = actor.items.filter((i) => i.type === "loot").sort((a, b) => a.sort - b.sort);

  const [weaponData, armorData, consumableData, lootData] = await Promise.all([
    Promise.all(weapons.map(createWeaponData)),
    Promise.all(armors.map(createArmorData)),
    Promise.all(consumables.map(createConsumableData)),
    Promise.all(loots.map(createLootData)),
  ]);

  return { weapons: weaponData, armors: armorData, consumables: consumableData, loots: lootData };
}

/** Mirror DHBaseActorSheet inventory quantity listeners. */
export function attachQuantityListeners(root) {
  root.querySelectorAll(".inventory-item-quantity").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", async (event) => {
      const target = event.currentTarget.closest("[data-item-uuid]");
      if (!target) return;
      const item = await fromUuid(target.dataset.itemUuid);
      await item?.update({ "system.quantity": event.currentTarget.value });
    });
  });
}

// ─── PARTY MEMBERS ───────────────────────────────────────────────────────────

/**
 * Sort comparator for party-member rows: a GM (or a player, by their own
 * ownership level) sees members they can fully see before ones they can't,
 * then alphabetical — matches the order the system's own party sheet uses.
 */
export function comparePartyMembersByOwnership(a, b) {
  const levelA = game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : a.getUserLevel(game.user);
  const levelB = game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : b.getUserLevel(game.user);
  if (levelB !== levelA) return levelB - levelA;
  return a.name.localeCompare(b.name);
}

/** A party actor's member documents, sorted via `comparePartyMembersByOwnership` and with any stale/unresolved entries dropped. */
export function getSortedPartyMembers(partyActor) {
  return [...(partyActor.system.partyMembers ?? [])].filter(Boolean).sort(comparePartyMembersByOwnership);
}

/**
 * The four resource pip pairs (hope/HP/stress/armor) every party-member
 * display reads off a member's own system data, as `{value, max}` pairs —
 * callers needing a flatter shape (e.g. the minisheet's compact pips)
 * destructure/rename from this rather than re-reading `actor.system` themselves.
 */
export function getPartyMemberPips(actor) {
  const sys = actor.system;
  return {
    hope: { value: sys.resources?.hope?.value ?? 0, max: sys.resources?.hope?.max ?? 0 },
    hitPoints: { value: sys.resources?.hitPoints?.value ?? 0, max: sys.resources?.hitPoints?.max ?? 0 },
    stress: { value: sys.resources?.stress?.value ?? 0, max: sys.resources?.stress?.max ?? 0 },
    armorSlots: { value: sys.armorScore?.value ?? 0, max: sys.armorScore?.max ?? 0 },
  };
}

// ─── CARD DESCRIPTION TOGGLE ──────────────────────────────────────────────────
// Every full sheet and several minisheets toggle a `.card-container.description`
// open/closed on click — components.css gives that element a `max-height`
// transition, so opening/closing here just needs to drive `max-height`
// to/from the card's own measured `scrollHeight` (never a hardcoded guess,
// which would either clip long content or make short content's animation
// look front-loaded).

/**
 * Sets a card's description panel open or closed, animated by default.
 * `animate: false` (state restoration after a re-render, not a user click)
 * briefly disables the transition via `.no-transition` so the panel snaps
 * back to its prior state instead of replaying the slide.
 */
export function setCardDescriptionOpen(description, open, { animate = true } = {}) {
  if (!description) return;

  if (!animate) description.classList.add("no-transition");
  description.style.maxHeight = open ? `${description.scrollHeight}px` : "0px";
  if (!animate) {
    void description.offsetHeight; // force layout so the transition-less jump is what actually paints
    requestAnimationFrame(() => description.classList.remove("no-transition"));
  }
}

/** Toggles a card's description panel (animated) and returns whether it's now open. */
export function toggleCardDescription(description) {
  const isOpen = description.style.maxHeight !== "" && description.style.maxHeight !== "0px";
  setCardDescriptionOpen(description, !isOpen);
  return !isOpen;
}

// ─── HANDLEBARS ──────────────────────────────────────────────────────────────

export function registerHelpers() {
  Handlebars.registerHelper("contains", function (array, value) {
    return Array.isArray(array) && array.includes(value);
  });

  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper("add", function (a, b) {
    return Number(a) + Number(b);
  });

  Handlebars.registerHelper("subtract", function (a, b) {
    return Number(a) - Number(b);
  });
}
