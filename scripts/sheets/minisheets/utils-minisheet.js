// ─── MACROBAR ────────────────────────────────────────────────────────────────

import {
  attachDieResourceListeners,
  attachHopeLabelListener,
  attachQuantityListeners,
  attachSimpleResourceListeners,
  attachUsesResourceListeners,
  modifyActorResource,
  recallDomainCardFromVault,
  resolveUnarmedAttack,
  setCardDescriptionOpen,
  toggleActorHope,
  toggleActorResource,
  toggleCardDescription,
} from "../../helpers.js";
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

// ─── TOOLTIP PATCH & EFFECTS DISPLAY ─────────────────────────────────────────
// Shared by the Character/Companion/Adversary minisheets (each a static-only
// class, so `host` below is the class itself, not an instance) — Party and
// Environment are trimmed variants without an effects display and don't call
// these. Per-minisheet-type state (`_tooltipPatched`/`_effectsObserver`/
// `_effectsOriginalParent`) still lives as static fields on each host class,
// not in here, since more than one minisheet type's static class can be
// "live" at once (e.g. a pinned Companion alongside a selected Adversary
// token) and each needs its own patch/mount bookkeeping.

/**
 * Monkey-patches `game.tooltip._setAnchor` once per host class so tooltips
 * opened from inside that minisheet anchor upward from the bottom of the
 * screen instead of Foundry's default direction. `excludeSelector` lets a
 * host opt a floating window (e.g. the Card Hand) out of the override even
 * though it's nested inside the minisheet's own DOM subtree.
 */
export function patchMinisheetTooltipManager(host, { excludeSelector = ".favorites-window" } = {}) {
  if (host._tooltipPatched) return;
  const mgr = game.tooltip;
  if (!mgr) return;

  const originalSetAnchor = mgr._setAnchor.bind(mgr);
  mgr._setAnchor = function (direction) {
    if (this.element?.closest("#enhanced-ui-sheet .minisheet") && !this.element?.closest(excludeSelector)) {
      const pad = this.constructor.TOOLTIP_MARGIN_PX;
      const pos = this.element.getBoundingClientRect();
      return this._setStyle({
        textAlign: "center",
        left: pos.left - this.tooltip.offsetWidth / 2 + pos.width / 2,
        bottom: window.innerHeight - pos.top + pad,
      });
    }
    return originalSetAnchor(direction);
  };

  host._tooltipPatched = true;
}

/**
 * Physically relocates Foundry's global `#effects-display` element into the
 * host's minisheet root while it's open (a real DOM-ownership handoff, not a
 * copy) — `minisheetSelector` picks that root out of the host's own element
 * (e.g. `.minisheet.character`). A `MutationObserver` keeps re-clearing the
 * `hidden` attribute the system's own code toggles on it, since that element
 * assumes it's still living in its usual native location.
 */
export function mountEffectsDisplay(host, minisheetSelector) {
  const effectsEl = document.getElementById("effects-display");
  if (!effectsEl) return;

  const minisheet = host.element?.querySelector(minisheetSelector);
  if (!minisheet) return;

  host._effectsOriginalParent = effectsEl.parentElement;
  minisheet.appendChild(effectsEl);
  effectsEl.removeAttribute("hidden");

  host._effectsObserver = new MutationObserver(() => effectsEl.removeAttribute("hidden"));
  host._effectsObserver.observe(effectsEl, { attributes: true, attributeFilter: ["hidden"] });
}

/** Reverses `mountEffectsDisplay`, handing `#effects-display` back to its original parent. */
export function unmountEffectsDisplay(host) {
  const effectsEl = document.getElementById("effects-display");

  if (host._effectsObserver) {
    host._effectsObserver.disconnect();
    host._effectsObserver = null;
  }

  if (effectsEl && host._effectsOriginalParent) {
    host._effectsOriginalParent.appendChild(effectsEl);
  }

  host._effectsOriginalParent = null;
}

// ─── MINISHEET RESOURCE LISTENERS ────────────────────────────────────────────

export function attachHopeListeners(element, actor) {
  element.querySelectorAll("[data-action='toggleHope']").forEach((el) => {
    el.addEventListener("click", (event) => toggleActorHope(actor, el));
  });

  attachHopeLabelListener(element, actor);
}

export function attachResourceListeners(element, actor) {
  element.querySelectorAll("[data-action='modifyResource']").forEach((el) => {
    el.addEventListener("click", (event) => modifyActorResource(event, actor, el));
    el.addEventListener("contextmenu", (event) => modifyActorResource(event, actor, el));
  });
}

export function attachToggleResourceListeners(element, actor) {
  element.querySelectorAll("[data-action='toggleResource']").forEach((el) => {
    el.addEventListener("click", (event) => toggleActorResource(event, actor, el));
    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleActorResource(event, actor, el);
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
  // isMinisheet isn't always passed accurately by every call site (the
  // Adversary/Environment minisheets' own features panels call this without
  // it, since they handle card expand/collapse themselves and don't want
  // _attachExpandCardListeners double-bound alongside their own — see
  // minisheet-adversary.js's _attachCardListeners) — but useAction/"More
  // Options" wiring needs to happen for them too. Detect the real minisheet
  // context directly off the DOM instead of trusting the flag for those.
  const inMinisheet = isMinisheet || !!element.closest("#enhanced-ui-sheet");

  if (isMinisheet) {
    _attachExpandCardListeners(element);
  } else {
    _attachCompactCardHoverListeners(element);
    _attachNavigateToCardListeners(element, actor);
  }
  _attachUseItemListeners(element, actor);
  _attachRollDamageListeners(element, actor);
  _attachToggleEquipListeners(element, actor);
  attachUsesResourceListeners(element);
  attachSimpleResourceListeners(element);
  attachDieResourceListeners(element);
  _attachDiceResourceListeners(element, actor);
  _attachRecallListeners(element, actor);
  attachQuantityListeners(element);
  _attachQuickAccessListeners(element, actor);
  if (inMinisheet) _attachUseActionListeners(element);
  _attachContextMenuListeners(element);
}

// ─── MORE OPTIONS (CONTEXT MENU) ─────────────────────────────────────────────

/**
 * The full sheets' own "More Options" (data-action="triggerContextMenu")
 * works for free there because those ARE real ApplicationV2 sheet instances
 * with their own inherited _createContextMenu/action-delegation from the
 * daggerheart system's base sheet class. Minisheets are hand-rendered HTML,
 * not ApplicationV2 instances, so that button was previously inert — no
 * listener anywhere wired it up. Skips full-sheet content (its own native
 * menu already handles that; binding a second one here would double it up)
 * by checking for #enhanced-ui-sheet, the id unique to minisheet containers.
 * Bound once per persistent element (dataset guard) since ContextMenu itself
 * attaches a delegated listener to `element` — re-render calls into
 * attachFavoritesListeners repeatedly against the SAME long-lived window
 * node (e.g. .inventory-window), so re-binding on every call would stack
 * duplicate menus.
 */
function _attachContextMenuListeners(element) {
  if (!element.closest("#enhanced-ui-sheet")) return;
  if (!element.querySelector("[data-action='triggerContextMenu']")) return;
  if (element.dataset.contextMenuBound) return;
  element.dataset.contextMenuBound = "true";

  new CONFIG.ux.ContextMenu(element, ".card-container.header[data-item-uuid]", _minisheetCardMenuItems(), { jQuery: false, fixed: true });

  element.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action='triggerContextMenu']");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    CONFIG.ux.ContextMenu.triggerContextMenu(event);
  });
}

function _minisheetCardMenuItems() {
  const hasEditableDoc = (target) => {
    const uuid = target.dataset.itemUuid;
    return !!uuid && uuid !== "unarmed-attack";
  };

  return [
    {
      name: "Edit",
      icon: '<i class="fa-solid fa-edit"></i>',
      condition: hasEditableDoc,
      callback: async (target) => {
        const doc = await fromUuid(target.dataset.itemUuid);
        doc?.sheet?.render(true);
      },
    },
    {
      name: "Duplicate",
      icon: '<i class="fa-solid fa-copy"></i>',
      condition: hasEditableDoc,
      callback: async (target) => {
        const doc = await fromUuid(target.dataset.itemUuid);
        if (doc?.parent) await doc.constructor.create(doc.toObject(), { parent: doc.parent });
      },
    },
    {
      name: "Delete",
      icon: '<i class="fa-solid fa-trash"></i>',
      condition: hasEditableDoc,
      callback: async (target) => {
        const doc = await fromUuid(target.dataset.itemUuid);
        if (!doc) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.format("DAGGERHEART.APPLICATIONS.DeleteConfirmation.title", { type: game.i18n.localize(`TYPES.${doc.documentName}.${doc.type}`), name: doc.name }) },
          content: game.i18n.format("DAGGERHEART.APPLICATIONS.DeleteConfirmation.text", { name: doc.name }),
        });
        if (confirmed) await doc.delete();
      },
    },
  ];
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
      if (description) toggleCardDescription(description);
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
            if (uuid !== itemUuid) setCardDescriptionOpen(desc, false, { animate: false });
          });

          const targetHeader = mainSheet.querySelector(`.card-container.header[data-item-uuid="${itemUuid}"]`);
          if (targetHeader) {
            const cardWrapper = targetHeader.closest(".card-wrapper");
            const description = cardWrapper?.querySelector(".card-container.description");
            setCardDescriptionOpen(description, true, { animate: false });
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
