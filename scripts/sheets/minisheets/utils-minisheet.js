// ─── MACROBAR ────────────────────────────────────────────────────────────────

import { attachQuantityListeners, recallDomainCardFromVault, resolveUnarmedAttack } from "../../helpers.js";
import { collapsedTransform } from "./minisheet-position.js";
import { selectPinnedActor, setFavoriteActor, pruneStaleFavorites } from "./minisheet-pin.js";

export function hideMacrobar() {
  const hotbar = document.getElementById("hotbar");
  if (hotbar) hotbar.style.display = "none";
  removeReopenButton();
}

export function showMacrobar() {
  const hotbar = document.getElementById("hotbar");
  if (!hotbar) return;
  hotbar.style.transition = "";
  hotbar.style.transform = "";
  hotbar.style.display = "";
}

// ─── MINISHEET RESOURCE LISTENERS ────────────────────────────────────────────

export function attachHopeListeners(element, actor) {
  element.querySelectorAll("[data-action='toggleHope']").forEach((el) => {
    el.addEventListener("click", (event) => _onToggleHope.call({ actor }, event, el));
  });

  const hopeLabel = element.querySelector(".hope-container h3");
  if (hopeLabel) {
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
}

export function attachResourceListeners(element, actor) {
  element.querySelectorAll("[data-action='modifyResource']").forEach((el) => {
    el.addEventListener("click", (event) => _onModifyResource.call({ actor }, event, el));
    el.addEventListener("contextmenu", (event) => _onModifyResource.call({ actor }, event, el));
  });
}

export function attachToggleResourceListeners(element, actor) {
  element.querySelectorAll("[data-action='toggleResource']").forEach((el) => {
    el.addEventListener("click", (event) => _onToggleResource.call({ actor }, event, el));
    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      _onToggleResource.call({ actor }, event, el);
    });
  });
}

export function attachTraitRollListeners(element, actor) {
  element.querySelectorAll("[data-action='rollAttribute']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      const attribute = el.dataset.attribute;
      if (!attribute) return;

      const abilityLabel = game.i18n.localize(CONFIG.DH.ACTOR.abilities[attribute].label);
      const config = {
        event,
        title: game.i18n.format("DAGGERHEART.UI.Chat.dualityRoll.abilityCheckTitle", { ability: abilityLabel }),
        headerTitle: `${game.i18n.localize("DAGGERHEART.GENERAL.dualityRoll")}: ${actor.name}`,
        effects: await game.system.api.data.actions.actionsTypes.base.getActionRelevantEffects(actor),
        roll: { trait: attribute, type: "trait" },
        hasRoll: true,
        actionType: "action",
      };

      const result = await actor.diceRoll(config);
      if (!result) return;

      const costResources = result.costs?.filter((x) => x.enabled).map((cost) => ({ ...cost, value: -cost.value, total: -cost.total })) || {};
      config.resourceUpdates.addResources(costResources);
      await config.resourceUpdates.updateResources();
    });
  });
}

export function attachDowntimeListeners(element, actor) {
  element.querySelectorAll("[data-action='useDowntime']").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const type = el.dataset.type;
      new game.system.api.applications.dialogs.Downtime(actor, type === "shortRest").render({ force: true });
    });
  });
}

export function attachReactionRollListeners(element, actor) {
  element.querySelectorAll("[data-action='reactionRoll']").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const config = {
        event,
        title: `Reaction Roll: ${actor.name}`,
        headerTitle: "Adversary Reaction Roll",
        roll: { type: "trait" },
        actionType: "reaction",
        hasRoll: true,
        data: actor.getRollData(),
      };
      actor.diceRoll(config);
    });
  });
}

// Actor picker overlay — shown over the portrait only when the minisheet is
// displaying via the pin fallback (no owned token controlling it, see
// minisheet-pin.js's buildActorPickerContext) and the player owns more than
// one pinnable actor. Shared by the Character and Companion minisheets since
// the picker itself is actor-type-agnostic (it just hands a uuid back to the
// coordinator, which decides which minisheet class to mount). Rendered as a
// sibling of .portrait (not nested inside it — see the template's own note)
// so it isn't clipped/faded by the portrait's own mask-image, and can extend
// past the minisheet's own top edge for a long actor list — mainly a GM
// concern (see buildActorPickerContext for the >5-actor "showExtras" UI:
// search, per-row favorite star, and a favorites-only view). Its
// outside-click-to-close behavior is wired once, globally, in
// minisheet-pin.js's registerMinisheetPin() rather than rebound here on
// every render — this function itself is called on every _attachListeners(),
// but its own listeners die naturally with the DOM nodes each render
// discards, so no accumulation to guard against.
export function attachActorPickerListeners(element) {
  const picker = element.querySelector(".minisheet-actor-picker");
  if (!picker) return;

  const panel = picker.querySelector(".minisheet-actor-picker-panel");
  const mainToggle = picker.querySelector(".minisheet-actor-picker-toggle");
  const favoritesToggle = picker.querySelector(".minisheet-actor-picker-favorites-toggle");
  const search = picker.querySelector(".minisheet-actor-picker-search");

  // Cap the panel at 2x the minisheet's own rendered height (the inner list
  // scrolls past that, search box stays put) — computed fresh each render
  // since the minisheet's height varies by actor type/content.
  if (panel) {
    const minisheetHeight = element.querySelector(".minisheet")?.offsetHeight ?? 0;
    panel.style.maxHeight = minisheetHeight ? `${minisheetHeight * 2}px` : "";
  }

  const openWith = (favoritesOnly) => {
    picker.classList.add("open");
    panel?.classList.toggle("favorites-only", favoritesOnly);
  };

  mainToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = picker.classList.contains("open");
    const isFavoritesOnly = panel?.classList.contains("favorites-only");
    if (isOpen && !isFavoritesOnly) picker.classList.remove("open");
    else openWith(false);
  });

  favoritesToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = picker.classList.contains("open");
    const isFavoritesOnly = panel?.classList.contains("favorites-only");
    if (isOpen && isFavoritesOnly) {
      picker.classList.remove("open");
    } else {
      openWith(true);
      pruneStaleFavorites();
    }
  });

  search?.addEventListener("click", (event) => event.stopPropagation());
  // Stops keystrokes (spacebar especially) from reaching Foundry's global
  // keybindings — e.g. the minisheet collapse shortcut — while typing here.
  search?.addEventListener("keydown", (event) => event.stopPropagation());
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    picker.querySelectorAll(".minisheet-actor-picker-item").forEach((item) => {
      const matches = !query || item.dataset.actorName.toLowerCase().includes(query);
      item.classList.toggle("search-hidden", !matches);
    });
  });

  picker.querySelectorAll(".minisheet-actor-picker-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest(".minisheet-actor-picker-star")) return;
      event.stopPropagation();
      picker.classList.remove("open");
      selectPinnedActor(item.dataset.actorUuid);
    });

    const star = item.querySelector(".minisheet-actor-picker-star");
    star?.addEventListener("click", (event) => {
      event.stopPropagation();
      const nowFavorite = !item.classList.contains("favorite");
      setFavoriteActor(item.dataset.actorUuid, nowFavorite);
      item.classList.toggle("favorite", nowFavorite);
      star.querySelector("i")?.classList.toggle("fa-solid", nowFavorite);
      star.querySelector("i")?.classList.toggle("fa-regular", !nowFavorite);
    });

    // Right-click-to-remove only makes sense in the favorites-only view —
    // in the full list it'd be ambiguous with "add to favorites" (that's
    // what the star button is for).
    item.addEventListener("contextmenu", (event) => {
      if (!panel?.classList.contains("favorites-only")) return;
      event.preventDefault();
      event.stopPropagation();
      showActorPickerContextMenu(event, () => {
        setFavoriteActor(item.dataset.actorUuid, false);
        item.classList.remove("favorite");
        const icon = item.querySelector(".minisheet-actor-picker-star i");
        icon?.classList.remove("fa-solid");
        icon?.classList.add("fa-regular");
      });
    });
  });
}

/**
 * A single-item right-click menu ("Remove from Favorites") for the actor
 * picker. Appended to document.body rather than nested inside the picker —
 * the minisheet sits inside a scaled `.minisheet-transform-wrapper`, and a
 * `transform` on an ancestor turns it into the containing block for any
 * `position:fixed` descendant, which would break positioning this at the
 * real cursor coordinates. minisheet-pin.js's global outside-click closer
 * knows to treat clicks on this menu as not "outside" the picker.
 */
function showActorPickerContextMenu(event, onRemove) {
  document.querySelectorAll(".minisheet-actor-picker-contextmenu").forEach((el) => el.remove());

  const menu = document.createElement("div");
  menu.className = "minisheet-actor-picker-contextmenu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  const removeItem = document.createElement("button");
  removeItem.type = "button";
  removeItem.textContent = "Remove from Favorites";
  removeItem.addEventListener("click", () => {
    onRemove();
    menu.remove();
  });

  menu.appendChild(removeItem);
  document.body.appendChild(menu);

  // Deferred so the same contextmenu event that opened this menu doesn't
  // immediately bubble into this listener and close it right back.
  setTimeout(() => {
    document.addEventListener(
      "click",
      () => menu.remove(),
      { once: true }
    );
  }, 0);
}

// ─── MINISHEET COLLAPSE STATE ─────────────────────────────────────────────────

export function isMinisheetCollapsed() {
  return game.user.getFlag("daggerheart-enhanced-ui", "minisheetCollapsed") ?? false;
}

export function setMinisheetCollapsed(value) {
  game.user.setFlag("daggerheart-enhanced-ui", "minisheetCollapsed", value);
}

export function triggerMinisheetToggle() {
  const reopenBtn = document.getElementById("minisheet-reopen-btn");
  if (reopenBtn) {
    reopenBtn.click();
    return;
  }
  document.querySelector("#enhanced-ui-sheet .toggle-minisheet.close")?.click();
}

export function registerMinisheetKeybinding() {
  game.keybindings.register("daggerheart-enhanced-ui", "toggleMinisheet", {
    name: "Toggle minisheet open/closed",
    editable: [{ key: "KeyC", modifiers: ["Alt"] }],
    onDown: () => triggerMinisheetToggle(),
  });
}

// ─── MINISHEET COLLAPSE ANIMATION ────────────────────────────────────────────

export function collapseMinisheet(element, onCollapsed) {
  const height = element.offsetHeight;
  element.style.transition = "transform 0.3s ease";
  element.style.transform = collapsedTransform(height);

  setTimeout(() => {
    if (onCollapsed) onCollapsed();
  }, 300);
}

// ─── REOPEN BUTTON ───────────────────────────────────────────────────────────

export function injectReopenButton(onReopen) {
  removeReopenButton(); // always clean up before injecting
  const hotbar = document.getElementById("hotbar");
  if (!hotbar) return;

  const btn = document.createElement("button");
  btn.id = "minisheet-reopen-btn";
  btn.classList.add("toggle-minisheet");
  btn.dataset.tooltip = "Open Mini Sheet";
  btn.innerHTML = `<i class="fa-solid fa-chevron-up"></i>`;
  hotbar.appendChild(btn); // inside #hotbar

  btn.addEventListener("click", () => {
    setMinisheetCollapsed(false);
    removeReopenButton();
    onReopen();
  });
}

export function removeReopenButton() {
  document.getElementById("minisheet-reopen-btn")?.remove();
}

// ─── MINISHEET RESOURCE HANDLERS ─────────────────────────────────────────────

async function _onToggleHope(event, target) {
  const value = parseInt(target.dataset.value);
  const current = this.actor.system.resources.hope.value;
  const newValue = value === current ? current - 1 : value;
  await this.actor.update({ "system.resources.hope.value": Math.max(0, newValue) });
}

async function _onModifyResource(event, target) {
  event.preventDefault();
  const resource = target.dataset.resource;
  let amount = parseInt(target.dataset.amount);

  if (event.type === "contextmenu") amount = -amount;

  if (resource === "system.armorScore.value") {
    await this.actor.system.updateArmorValue({ value: amount });
  } else if (resource === "system.armor.system.armor.current") {
    // backwards-compat branch
    const armorItem = this.actor.items.get(this.actor.system.armor._id);
    if (!armorItem) return;
    const currentValue = armorItem.system.armor.current;
    const maxValue = this.actor.system.armorScore;
    const newValue = Math.max(0, Math.min(maxValue, currentValue + amount));
    await armorItem.update({ "system.armor.current": newValue });
  } else {
    const currentValue = foundry.utils.getProperty(this.actor, resource);
    const maxPath = resource.replace(".value", ".max");
    const maxValue = foundry.utils.getProperty(this.actor, maxPath);
    const newValue = Math.max(0, Math.min(maxValue, currentValue + amount));
    await this.actor.update({ [resource]: newValue });
  }
}

async function _onToggleResource(event, target) {
  const resource = target.dataset.resource;
  const clickedValue = parseInt(target.dataset.value);

  if (resource === "system.armorScore.value") {
    const currentValue = foundry.utils.getProperty(this.actor, "system.armorScore.value");
    const newValue = clickedValue === currentValue ? currentValue - 1 : clickedValue;
    const delta = newValue - currentValue;
    await this.actor.system.updateArmorValue({ value: delta });
  } else if (resource === "system.armor.system.armor.current") {
    // backwards-compat branch
    const armorItem = this.actor.items.get(this.actor.system.armor._id);
    if (!armorItem) return;
    const currentValue = armorItem.system.armor.current;
    const newValue = Math.max(0, clickedValue === currentValue ? currentValue - 1 : clickedValue);
    await armorItem.update({ "system.armor.current": newValue });
  } else {
    const currentValue = foundry.utils.getProperty(this.actor, resource);
    const newValue = Math.max(0, clickedValue === currentValue ? currentValue - 1 : clickedValue);
    await this.actor.update({ [resource]: newValue });
  }
}

// ─── FAVORITES WINDOW ────────────────────────────────────────────────────────

let _hoveredCompactCard = null;

export async function renderFavorites(element, actor, templatePath, context) {
  // :not(.inventory-window) matters in Standard mode: the Inventory window
  // reuses the .favorites-window class for its own CSS (see inventory-panel.js),
  // and without this exclusion this function would find IT instead (the real
  // Quick Access .favorites-window doesn't exist in Standard mode) and
  // overwrite its content with favorites.hbs's own render — which is exactly
  // what was happening: toggling a weapon's equipped state from the
  // Inventory window triggered this function, which clobbered Inventory's
  // content with the old "Equipment & Loadout" list.
  const favWindow = element.querySelector(".favorites-window:not(.inventory-window)");
  if (!favWindow) return;

  const scrollTop = favWindow.querySelector(".favorites")?.scrollTop ?? 0;

  const html = await foundry.applications.handlebars.renderTemplate(templatePath, context);

  favWindow.innerHTML = html;

  const newFavoritesList = favWindow.querySelector(".favorites");
  if (newFavoritesList) newFavoritesList.scrollTop = scrollTop;

  attachFavoritesListeners(favWindow, actor, { isMinisheet: !!context.isMinisheet });
  if (!context.isMinisheet) _restoreCompactCardHover(favWindow);
}

export function attachFavoritesListeners(element, actor, { isMinisheet = false } = {}) {
  if (isMinisheet) {
    _attachExpandCardListeners(element);
  } else {
    _attachCompactCardHoverListeners(element);
    _attachNavigateToCardListeners(element, actor);
  }
  _attachUseItemListeners(element, actor);
  _attachRollDamageListeners(element, actor);
  _attachToggleEquipListeners(element, actor);
  _attachUsesListeners(element, actor);
  _attachSimpleResourceListeners(element, actor);
  _attachDieResourceListeners(element, actor);
  _attachDiceResourceListeners(element, actor);
  _attachRecallListeners(element, actor);
  attachQuantityListeners(element);
  _attachQuickAccessListeners(element, actor);
  if (isMinisheet) _attachUseActionListeners(element);
}

// ─── FAVORITES HELPERS ───────────────────────────────────────────────────────

function _closeFavoritesWindow(element) {
  const favWindow = element.closest(".favorites-window, .card-hand-window");
  if (!favWindow?.classList.contains("active")) return;
  favWindow.classList.remove("active");
  favWindow.closest(".minisheet")?.querySelector(`.tab-button.active[data-hand-target="${favWindow.classList.contains("card-hand-window") ? "cardHand" : "favorites"}"]`)?.classList.remove("active");
}

function _attachCompactCardHoverListeners(element) {
  element.querySelectorAll(".compact.card-wrapper").forEach((card) => {
    const hoverArea = card.querySelector(".hover-area");
    if (!hoverArea) return;

    hoverArea.addEventListener("mouseenter", () => {
      _hoveredCompactCard = card.dataset.itemUuid;
    });

    hoverArea.addEventListener("mouseleave", () => {
      _hoveredCompactCard = null;
      hoverArea.classList.remove("force-hover");
    });
  });
}

function _restoreCompactCardHover(element) {
  if (!_hoveredCompactCard) return;

  const card = element.querySelector(`.compact.card-wrapper[data-item-uuid="${_hoveredCompactCard}"]`);
  if (!card) return;

  const hoverArea = card.querySelector(".hover-area");
  if (!hoverArea) return;

  hoverArea.classList.add("force-hover");

  setTimeout(() => {
    if (!hoverArea.matches(":hover")) {
      hoverArea.classList.remove("force-hover");
      _hoveredCompactCard = null;
    }
  }, 100);
}

function _attachExpandCardListeners(element) {
  element.querySelectorAll(".card-text, .card-resource").forEach((nameContainer) => {
    nameContainer.addEventListener("click", (event) => {
      if (event.target.closest('.card-controls, [data-action="useItem"], .uses-resource, .simple-resource, .die-resource, .dice-resource, .recall-resource, .roll-damage, .quantity-resource')) {
        return;
      }

      const cardWrapper = nameContainer.closest(".card-wrapper");
      if (!cardWrapper || cardWrapper.dataset.itemUuid === "unarmed-attack") return;

      const description = cardWrapper.querySelector(".card-container.description");
      if (description) {
        const isHidden = description.style.display === "none" || !description.style.display;
        description.style.display = isHidden ? "flex" : "none";
      }
    });
  });
}

function _attachUseActionListeners(element) {
  element.querySelectorAll('[data-action="useAction"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();

      const itemUuid = button.dataset.itemUuid || button.closest("[data-item-uuid]")?.dataset.itemUuid;
      const actionId = button.dataset.actionId;
      if (!itemUuid || !actionId) return;

      const item = await fromUuid(itemUuid);
      if (!item) {
        ui.notifications.warn("Item not found");
        return;
      }

      const action = item.system.actions?.get(actionId);
      if (!action) {
        ui.notifications.warn("Action not found");
        return;
      }

      await action.use(event);
    });
  });
}

function _attachNavigateToCardListeners(element, actor) {
  element.querySelectorAll("[data-action='navigateToCard']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      if (event.target.closest(".card-icon, .hover-area, .uses-resource, .simple-resource, .die-resource, .dice-resource, .recall-resource, .roll-damage, .quantity-resource")) return;

      event.preventDefault();
      event.stopPropagation();

      const itemUuid = el.dataset.itemUuid;
      const itemType = el.dataset.type;

      if (!itemUuid) return;

      let targetTab = null;
      if (itemType === "domainCard") targetTab = "loadout";
      else if (["weapon", "armor", "consumable", "loot"].includes(itemType)) targetTab = "inventory";
      else if (itemType === "feature") targetTab = "features";

      if (!targetTab) return;

      if (!actor.sheet.rendered) {
        await actor.sheet.render(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const sheet = actor.sheet;
      const needsTabSwitch = !sheet.tabs[targetTab].active;
      const wasAlreadyOpen = sheet.openCards.has(itemUuid);
      const cardsToReopen = wasAlreadyOpen ? [itemUuid] : [];

      sheet.openCards.clear();
      cardsToReopen.forEach((uuid) => sheet.openCards.add(uuid));
      sheet.openCards.add(itemUuid);

      if (needsTabSwitch) {
        Object.keys(sheet.tabs).forEach((key) => {
          sheet.tabs[key].active = key === targetTab;
        });
        await sheet.render(false, { parts: ["mainSheet"] });
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        const mainSheet = sheet.element.querySelector(".tab-content");
        if (mainSheet) {
          mainSheet.querySelectorAll(".card-container.description").forEach((desc) => {
            const wrapper = desc.closest(".card-wrapper");
            const uuid = wrapper?.querySelector("[data-item-uuid]")?.dataset.itemUuid;
            if (uuid !== itemUuid) desc.style.display = "none";
          });

          const targetHeader = mainSheet.querySelector(`.card-container.header[data-item-uuid="${itemUuid}"]`);
          if (targetHeader) {
            const cardWrapper = targetHeader.closest(".card-wrapper");
            const description = cardWrapper?.querySelector(".card-container.description");
            if (description) description.style.display = "flex";
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const mainSheet = sheet.element.querySelector(".tab-content");
      if (!mainSheet) return;

      const originalCard = mainSheet.querySelector(`.card-container.header[data-item-uuid="${itemUuid}"]`);
      if (!originalCard) return;

      const cardWrapper = originalCard.closest(".card-wrapper");
      if (cardWrapper) {
        const margin = 32;
        const cardHeight = cardWrapper.offsetHeight;
        const containerHeight = mainSheet.clientHeight;

        if (cardHeight + margin * 2 <= containerHeight) {
          mainSheet.scrollTo({ top: cardWrapper.offsetTop - margin, behavior: "smooth" });
        } else {
          mainSheet.scrollTo({ top: cardWrapper.offsetTop - margin });
        }

        cardWrapper.style.transition = "background-color 0.5s ease";
        cardWrapper.style.backgroundColor = "rgba(79, 89, 137, 0.3)";
        setTimeout(() => {
          cardWrapper.style.backgroundColor = "";
        }, 500);
      }
    });
  });
}

function _attachUseItemListeners(element, actor) {
  element.querySelectorAll("[data-action='useItem']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      _closeFavoritesWindow(el);
      const itemUuid = el.dataset.itemUuid || el.closest("[data-item-uuid]")?.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      await item.use(event);
    });
  });

  element.querySelectorAll("[data-action='useUnarmedAttack']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      _closeFavoritesWindow(el);
      const action = resolveUnarmedAttack(actor);
      if (action) await action.use(event);
    });
  });

  element.querySelectorAll("[data-action='toChat']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      const itemUuid = el.dataset.itemUuid || el.closest("[data-item-uuid]")?.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (item) await item.toChat(itemUuid);
    });
  });
}

function _attachRollDamageListeners(element, actor) {
  element.querySelectorAll(".roll-damage").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const itemUuid = el.dataset.itemUuid;
      if (itemUuid === "unarmed-attack") {
        const action = resolveUnarmedAttack(actor);
        if (!action) return;
        const config = action.prepareConfig(event);
        config.effects = await game.system.api.data.actions.actionsTypes.base.getActionRelevantEffects(actor, null);
        config.hasRoll = false;
        action.workflow.get("damage").execute(config, null, true);
        return;
      }
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const action = item.system.attack;
      const config = action.prepareConfig(event);
      config.effects = await game.system.api.data.actions.actionsTypes.base.getActionRelevantEffects(actor, item);
      config.hasRoll = false;
      action.workflow.get("damage").execute(config, null, true);
    });
  });
}

function _attachToggleEquipListeners(element, actor) {
  element.querySelectorAll("[data-action='toggleEquipItem']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;

      // Unequip path — same for both types
      if (item.system.equipped) {
        await item.update({ "system.equipped": false });
        return;
      }

      const actor = item.parent;

      if (item.type === "armor") {
        const currentArmor = actor?.system?.armor;
        if (currentArmor) {
          await currentArmor.update({ "system.equipped": false });
        }
        await item.update({ "system.equipped": true });
      } else if (item.type === "weapon") {
        // Block equipping during beastform
        if (actor?.effects?.find((x) => !x.disabled && x.type === "beastform")) {
          ui.notifications.warn(game.i18n.localize("DAGGERHEART.UI.Notifications.beastformEquipWeapon"));
          return;
        }

        await actor.system.constructor.unequipBeforeEquip.bind(actor.system)(item);
        await item.update({ "system.equipped": true });
      }
    });
  });
}

function _attachUsesListeners(element, actor) {
  element.querySelectorAll(".uses-resource").forEach((el) => {
    el.addEventListener("click", async (event) => {
      const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
      const actionId = el.dataset.actionId;
      if (!itemUuid || !actionId) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const action = item.system.actions?.get(actionId);
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
        if (!item) return;
        const action = item.system.actions?.get(actionId);
        if (!action?.uses) return;
        await action.update({ "uses.value": Math.min(action.uses.max, action.uses.value + 1) });
      },
      true,
    );
  });
}

function _attachSimpleResourceListeners(element, actor) {
  element.querySelectorAll(".simple-resource").forEach((el) => {
    el.addEventListener("click", async (event) => {
      const itemUuid = el.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const maxValue = parseInt(el.dataset.max) || 0;
      const newValue = Math.min(maxValue, (item.system.resource.value || 0) + 1);
      await item.update({ "system.resource.value": newValue });
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

function _attachDieResourceListeners(element, actor) {
  element.querySelectorAll(".die-resource").forEach((el) => {
    el.addEventListener("click", async (event) => {
      const itemUuid = el.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      if (!item) return;
      const dieFaces = parseInt(el.dataset.dieFaces?.replace("d", "")) || 6;
      const newValue = ((item.system.resource.value || 0) + 1) % (dieFaces + 1);
      await item.update({ "system.resource.value": newValue });
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

function _attachDiceResourceListeners(element, actor) {
  element.querySelectorAll(".dice-resource").forEach((resource) => {
    // Reroll button
    resource.querySelectorAll("[data-action='handleResourceDice']").forEach((el) => {
      el.addEventListener("click", async (event) => {
        event.stopPropagation();
        const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;
        const rollValues = await game.system.api.applications.dialogs.ResourceDiceDialog.create(item, actor);
        if (!rollValues) return;
        await item.update({
          "system.resource.diceStates": rollValues.reduce((acc, state, index) => {
            acc[index] = { value: state.value, used: state.used };
            return acc;
          }, {}),
        });
      });
    });

    // Toggle individual dice
    resource.querySelectorAll(".dice-value").forEach((diceValue) => {
      diceValue.addEventListener("click", async (event) => {
        event.stopPropagation();
        const itemUuid = diceValue.closest("[data-item-uuid]")?.dataset.itemUuid;
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;
        const diceIndex = diceValue.dataset.dice;
        const currentState = item.system.resource.diceStates[diceIndex];
        if (!currentState) return;
        await item.update({ [`system.resource.diceStates.${diceIndex}.used`]: !currentState.used });
      });
    });
  });
}

function _attachRecallListeners(element, actor) {
  element.querySelectorAll(".recall-resource").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
      if (!itemUuid) return;
      const item = await fromUuid(itemUuid);
      await recallDomainCardFromVault(item, event);
    });
  });
}

function _attachQuickAccessListeners(element, actor) {
  element.querySelectorAll("[data-action='removeFromQuickAccess']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      const itemUuid = el.dataset.itemUuid;
      if (!itemUuid) return;
      const quickAccessItems = actor.getFlag("daggerheart-enhanced-ui", "quickAccess") || [];
      await actor.setFlag(
        "daggerheart-enhanced-ui",
        "quickAccess",
        quickAccessItems.filter((uuid) => uuid !== itemUuid),
      );
    });
  });

  element.querySelectorAll("[data-action='addQuickAccessDivider']").forEach((el) => {
    el.addEventListener("click", async (event) => {
      event.stopPropagation();
      const quickAccessItems = actor.getFlag("daggerheart-enhanced-ui", "quickAccess") || [];
      quickAccessItems.unshift(`divider-${foundry.utils.randomID()}`);
      await actor.setFlag("daggerheart-enhanced-ui", "quickAccess", quickAccessItems);
    });
  });
}
