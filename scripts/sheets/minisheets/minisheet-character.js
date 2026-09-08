import {
  hideMacrobar,
  collapseMinisheet,
  injectReopenButton,
  removeReopenButton,
  isMinisheetCollapsed,
  setMinisheetCollapsed,
  showMacrobar,
  attachResourceListeners,
  attachToggleResourceListeners,
  attachHopeListeners,
  attachTraitRollListeners,
  attachFavoritesListeners,
  renderFavorites,
  attachDowntimeListeners,
  attachActorPickerListeners,
} from "./utils-minisheet.js";

import { applyMinisheetScale } from "../../settings.js";
import { toggleResourceManagement, toggleArmorManagement, formatWeaponDamageDisplay, getBeastformPortrait, resolveUnarmedAttack } from "../../helpers.js";
import { renderCardHandWindow, getCardHandOpenState, setCardHandOpenState, renderCardHandReorderPopover } from "../../card-hand.js";
import { renderInventoryWindow, renderInventoryFilterPopover, getInventoryOpenState, setInventoryOpenState } from "../../inventory-panel.js";
import { injectMinisheetContainer, idleTransform, collapsedTransform } from "./minisheet-position.js";
import { buildActorPickerContext, syncPinnedMinisheet } from "./minisheet-pin.js";

// CharacterMiniSheet is a static-only class scoped inside registerCharacterMiniSheet()'s
// closure, so a module-scope reference is needed for other modules (card-hand.js's
// favoritesDisplayMode setting) to force a re-render — that setting changes which
// buttons/windows the minisheet's own template renders, not just a CSS toggle, so a
// live setting change needs a real re-render to take effect without a page reload.
let _characterMiniSheetRef = null;

export function refreshCharacterMiniSheet() {
  if (_characterMiniSheetRef?.currentActor) _characterMiniSheetRef._render();
}

// Entry points for minisheet-pin.js's cross-type coordinator — it decides
// *which* actor (and which minisheet class) should be showing, these just
// carry that decision out against this class's own static state.
export function showCharacterMiniSheetActor(actor) {
  if (!_characterMiniSheetRef) return;
  if (_characterMiniSheetRef.currentActor === actor && _characterMiniSheetRef.element) return;
  _characterMiniSheetRef.currentActor = actor;
  _characterMiniSheetRef._render();
}

export function teardownCharacterMiniSheet() {
  if (!_characterMiniSheetRef?.currentActor && !_characterMiniSheetRef?.element) return;
  _characterMiniSheetRef._teardown();
}

export function registerCharacterMiniSheet() {
  if (game.system.id !== "daggerheart") return;
  if (!game.settings.get("daggerheart-sleek-ui", "enableMinisheet")) return;

  class CharacterMiniSheet {
    static currentActor = null;
    static element = null;
    static _tooltipPatched = false;
    static _effectsObserver = null;
    static _effectsOriginalParent = null;
    static _outsideClickListener = null;

    static _mountEffectsDisplay() {
      const effectsEl = document.getElementById("effects-display");
      if (!effectsEl) return;

      const minisheet = this.element?.querySelector(".minisheet.character");
      if (!minisheet) return;

      this._effectsOriginalParent = effectsEl.parentElement;
      minisheet.appendChild(effectsEl);
      effectsEl.removeAttribute("hidden");

      this._effectsObserver = new MutationObserver(() => effectsEl.removeAttribute("hidden"));
      this._effectsObserver.observe(effectsEl, { attributes: true, attributeFilter: ["hidden"] });
    }

    static _unmountEffectsDisplay() {
      const effectsEl = document.getElementById("effects-display");

      if (this._effectsObserver) {
        this._effectsObserver.disconnect();
        this._effectsObserver = null;
      }

      if (effectsEl && this._effectsOriginalParent) {
        this._effectsOriginalParent.appendChild(effectsEl);
      }

      this._effectsOriginalParent = null;
    }

    static _patchTooltipManager() {
      if (this._tooltipPatched) return;
      const mgr = game.tooltip;
      if (!mgr) return;

      const originalSetAnchor = mgr._setAnchor.bind(mgr);
      mgr._setAnchor = function (direction) {
        if (this.element?.closest("#sleek-ui-sheet .minisheet") && !this.element?.closest(".favorites-window, .card-hand-window")) {
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

      this._tooltipPatched = true;
    }

    static _onUpdateActor(actor) {
      if (actor === this.currentActor) this._render();
    }

    static _onUpdateItem(item) {
      if (item.parent !== this.currentActor) return;
      if (item === this.currentActor.system.armor) {
        this._render();
      } else {
        this._renderFavorites();
        this._renderCardHand();
        this._renderInventory();
      }
    }

    static async _render() {
      if (!this.currentActor) return;

      // Preserve open-window state across re-renders. ".favorites-window"
      // alone would also match the Inventory window (it carries that class
      // too, to reuse its styling) — excluding ".inventory-window" keeps
      // this specifically about the real Quick Access window.
      const favWasActive = this.element?.querySelector(".favorites-window:not(.inventory-window)")?.classList.contains("active") ?? false;
      // On a fresh mount (this.element didn't exist yet — e.g. reselecting a
      // token, or a fresh page load) there's no DOM to read the prior state
      // off of, so fall back to the persisted setting instead of always
      // defaulting closed: "if the user didn't close it, it's always open."
      const cardHandWasActive = this.element ? (this.element.querySelector(".card-hand-window")?.classList.contains("active") ?? false) : getCardHandOpenState();
      const inventoryWasActive = this.element ? (this.element.querySelector(".inventory-window")?.classList.contains("active") ?? false) : getInventoryOpenState();

      const effectsEl = document.getElementById("effects-display");
      const wasInMinisheet = effectsEl && this.element?.contains(effectsEl);
      if (wasInMinisheet) document.body.appendChild(effectsEl);

      const context = await this._prepareContext(this.currentActor);
      if (!this.currentActor) return;

      const html = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-sleek-ui/templates/sheets/characters/minisheet.hbs", context);
      if (!this.currentActor) return;

      if (!this.element) {
        this._injectContainer();
        hideMacrobar();
      }

      const scaleWrapper = this.element.querySelector(".minisheet-transform-wrapper");
      scaleWrapper.innerHTML = html;

      const collapsed = isMinisheetCollapsed();

      // Inject close button into the minisheet
      const minisheet = this.element.querySelector(".minisheet");
      if (minisheet) {
        const closeBtn = document.createElement("button");
        closeBtn.classList.add("toggle-minisheet", "close");
        closeBtn.dataset.tooltip = "Close Mini Sheet";
        closeBtn.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
        minisheet.appendChild(closeBtn);

        closeBtn.addEventListener("click", () => {
          setMinisheetCollapsed(true);
          collapseMinisheet(this.element, () => {
            this._unmountEffectsDisplay();
            injectReopenButton(() => {
              hideMacrobar();
              this.element.style.transition = "transform 0.3s ease";
              this.element.style.transform = idleTransform();
              this._mountEffectsDisplay();
              setTimeout(() => applyMinisheetScale(), 310);
            });

            // Animate macrobar up
            const hotbar = document.getElementById("hotbar");
            if (hotbar) {
              hotbar.style.transition = "none";
              hotbar.style.transform = `translateY(100%)`;
              hotbar.style.display = "";
              // Force reflow so the initial transform is applied before animating
              hotbar.offsetHeight;
              hotbar.style.transition = "transform 0.3s ease";
              hotbar.style.transform = `translateY(0)`;
            }
          });
        });
      }

      if (favWasActive) {
        const favWindow = this.element.querySelector(".favorites-window:not(.inventory-window)");
        const tabBtn = this.element.querySelector('.tab-button[data-hand-target="favorites"]');
        favWindow?.classList.add("active");
        tabBtn?.classList.add("active");
      }

      if (cardHandWasActive) {
        const cardHandWindow = this.element.querySelector(".card-hand-window");
        const tabBtn = this.element.querySelector('.tab-button[data-hand-target="cardHand"]');
        cardHandWindow?.classList.add("active");
        tabBtn?.classList.add("active");
      }

      if (inventoryWasActive) {
        const inventoryWindow = this.element.querySelector(".inventory-window");
        const tabBtn = this.element.querySelector('.tab-button[data-hand-target="inventory"]');
        inventoryWindow?.classList.add("active");
        tabBtn?.classList.add("active");
      }

      this._attachListeners();
      this._patchTooltipManager(); // skip in party minisheet, it doesn't have this
      renderCardHandWindow(this.element, this.currentActor);
      renderInventoryWindow(this.element, this.currentActor);

      if (collapsed) {
        const height = this.element.offsetHeight;
        this.element.style.transition = "none";
        this.element.style.transform = collapsedTransform(height);
        showMacrobar();
        injectReopenButton(() => {
          hideMacrobar();
          this.element.style.transition = "transform 0.3s ease";
          this.element.style.transform = idleTransform();
          this._mountEffectsDisplay();
          setTimeout(() => applyMinisheetScale(), 310);
        });
      } else {
        this.element.style.transition = "";
        this.element.style.transform = idleTransform();
        applyMinisheetScale();
      }

      // Effects display — only mount if not collapsed
      if (wasInMinisheet && !collapsed) {
        const ms = this.element.querySelector(".minisheet");
        if (ms) {
          ms.appendChild(effectsEl);
          effectsEl.removeAttribute("hidden");
        }
      } else if (!collapsed) {
        this._mountEffectsDisplay();
      }
    }

    static async _renderFavorites() {
      if (!this.currentActor || !this.element) return;

      const context = await this._prepareContext(this.currentActor);
      await renderFavorites(this.element, this.currentActor, "modules/daggerheart-sleek-ui/templates/sheets/characters/main/favorites.hbs", context);
    }

    static _renderCardHand() {
      if (!this.currentActor || !this.element) return;
      renderCardHandWindow(this.element, this.currentActor);
    }

    static _renderInventory() {
      if (!this.currentActor || !this.element) return;
      renderInventoryWindow(this.element, this.currentActor);
    }

    static _teardown() {
      this._unmountEffectsDisplay();
      removeReopenButton();

      if (this._outsideClickListener) {
        document.removeEventListener("click", this._outsideClickListener);
        this._outsideClickListener = null;
      }

      this.currentActor = null;

      if (this.element) {
        this.element.remove();
        this.element = null;
      }

      showMacrobar();
    }

    static _injectContainer() {
      this.element = injectMinisheetContainer();
    }

    static async _prepareContext(actor) {
      const systemContext = await actor.sheet._prepareContext({});
      await actor.sheet._prepareHeaderContext(systemContext, {});

      let { weapons, armors, loadoutCards, quickAccess, quickAccessItems, unarmedAttack } = systemContext;

      const isSleekSheet = actor.sheet?.constructor?.name === "SleekCharacterSheet";

      if (!isSleekSheet) {
        weapons = actor.items.filter((i) => i.type === "weapon").map((item) => ({
          item,
          tags: [],
          hopeCost: 0,
          usesData: null,
          enrichedDescription: "",
          damage: formatWeaponDamageDisplay(item.system.attack, {
            rollData: item.getRollData?.() ?? actor.getRollData(),
          }),
        }));

        armors = actor.items
          .filter((i) => i.type === "armor")
          .map((item) => ({
            item,
            tags: [],
            hopeCost: 0,
            usesData: null,
            marks: item.system.marks ?? null,
            enrichedDescription: "",
          }));

        loadoutCards = (actor.system.domainCards?.loadout ?? []).map((item) => ({
          item,
          tags: [],
          hopeCost: 0,
          usesData: null,
        }));

        const unarmed = resolveUnarmedAttack(actor);
        unarmedAttack = unarmed
          ? {
              item: {
                name: game.i18n.localize(unarmed.name || "DAGGERHEART.GENERAL.unarmedAttack"),
                img: unarmed.img,
                uuid: "unarmed-attack",
                system: {
                  actions: new Map([[unarmed._id, unarmed]]),
                  attack: unarmed,
                },
              },
              tags: [],
              hopeCost: 0,
              usesData: null,
              damage: formatWeaponDamageDisplay(unarmed, { rollData: actor.getRollData() }),
              enrichedDescription: "",
            }
          : null;

        quickAccess = false;
        quickAccessItems = [];
      }

      const favoritesDisplayMode = game.settings.get("daggerheart-sleek-ui", "favoritesDisplayMode");

      return {
        document: actor,
        source: actor,
        actor,
        hasExtraResources: systemContext.hasExtraResources,
        ownershipLevel: game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : actor.getUserLevel(game.user),
        showTooltip: game.settings.get("daggerheart-sleek-ui", "showTooltip"),
        isMinisheet: true,
        isCharacterSheet: true,
        attributes: systemContext.attributes,
        isDeath: actor.system.deathMoveViable,
        beastformPortrait: getBeastformPortrait(actor),
        quickAccess,
        quickAccessItems,
        unarmedAttack,
        weapons,
        armors,
        loadoutCards,
        favoritesDisplayMode,
        actorPicker: buildActorPickerContext(actor),
      };
    }

    static _attachListeners() {
      if (!this.element || !this.currentActor) return;

      const actor = this.currentActor;

      attachHopeListeners(this.element, actor);
      attachResourceListeners(this.element, actor);
      attachToggleResourceListeners(this.element, actor);
      attachTraitRollListeners(this.element, actor);
      attachDowntimeListeners(this.element, actor);

      this.element.querySelector(".resource-manager")?.addEventListener("click", (event) => {
        toggleResourceManagement(event, event.currentTarget, actor);
      });

      this.element.querySelector(".armor-details-btn")?.addEventListener("click", (event) => {
        toggleArmorManagement(event, event.currentTarget, actor);
      });

      this.element.querySelectorAll("[data-action='openSheet']").forEach((el) => {
        el.addEventListener("click", () => actor.sheet?.render(true));
      });

      this.element.querySelectorAll("[data-action='makeDeathMove']").forEach((el) => {
        el.addEventListener("click", async () => {
          await new game.system.api.applications.dialogs.DeathMove(actor).render({ force: true });
        });
      });

      attachFavoritesListeners(this.element, actor, { isMinisheet: true });
      attachActorPickerListeners(this.element);

      // Tab button toggle — Quick Access mode renders one button, Standard
      // mode renders two (Inventory + Hand) — either way each button just
      // opens/closes its own window.
      const windowSelectorFor = (target) => {
        if (target === "cardHand") return ".card-hand-window";
        if (target === "inventory") return ".inventory-window";
        return ".favorites-window";
      };

      // Inventory and Hand are both meant to behave like persistent HUD
      // elements, not popups — they only close via their own toggle button,
      // never from an outside click, and remember whether they were left
      // open across a minisheet remount (reselecting a token, reloading).
      const isPersistentTarget = (target) => target === "cardHand" || target === "inventory";
      const setPersistentOpenState = (target, value) => {
        if (target === "cardHand") setCardHandOpenState(value);
        else if (target === "inventory") setInventoryOpenState(value);
      };

      this.element.querySelectorAll(".tab-button").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const targetWindow = this.element.querySelector(windowSelectorFor(btn.dataset.handTarget));
          const isActive = targetWindow?.classList.contains("active");
          const nextActive = !isActive;
          targetWindow?.classList.toggle("active", nextActive);
          btn.classList.toggle("active", nextActive);
          if (isPersistentTarget(btn.dataset.handTarget)) setPersistentOpenState(btn.dataset.handTarget, nextActive);
        });
      });

      // Filter/reorder popovers — quick on-the-fly panels next to the
      // Inventory and Hand buttons. Two separate .hand-filter-btn elements
      // can exist now (Inventory's own filter, Hand's own reorder list —
      // Hand has no filter of its own any more: with weapons/consumables
      // moved to Inventory, everything Hand shows is a real card, so
      // there's nothing left to hide), each paired with the popover that's
      // its own sibling within the same .tab-button-group, dispatching to a
      // different render function based on its own data-action.
      this.element.querySelectorAll(".hand-filter-btn").forEach((filterBtn) => {
        filterBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const popover = filterBtn.closest(".tab-button-group")?.querySelector(".hand-filter-popover");
          if (!popover) return;
          const isActive = popover.classList.contains("active");
          if (!isActive) {
            if (filterBtn.dataset.action === "toggleInventoryFilters") renderInventoryFilterPopover(popover, this.element, actor);
            else if (filterBtn.dataset.action === "toggleHandReorder") renderCardHandReorderPopover(popover, this.element, actor);
          }
          popover.classList.toggle("active", !isActive);
          filterBtn.classList.toggle("active", !isActive);
        });
      });

      // Close on outside click — remove previous listener before adding new one
      if (this._outsideClickListener) {
        document.removeEventListener("click", this._outsideClickListener);
      }

      this._outsideClickListener = (event) => {
        if (!this.element) return;
        this.element.querySelectorAll(".tab-button").forEach((btn) => {
          if (isPersistentTarget(btn.dataset.handTarget)) return;
          const targetWindow = this.element.querySelector(windowSelectorFor(btn.dataset.handTarget));
          if (!targetWindow?.classList.contains("active")) return;
          if (!targetWindow.contains(event.target) && !event.target.closest(".tab-button")) {
            targetWindow.classList.remove("active");
            btn.classList.remove("active");
          }
        });

        this.element.querySelectorAll(".hand-filter-popover").forEach((filterPopover) => {
          const filterBtn = filterPopover.closest(".tab-button-group")?.querySelector(".hand-filter-btn");
          if (filterPopover.classList.contains("active") && !filterPopover.contains(event.target) && event.target !== filterBtn && !filterBtn?.contains(event.target)) {
            filterPopover.classList.remove("active");
            filterBtn?.classList.remove("active");
          }
        });
      };

      document.addEventListener("click", this._outsideClickListener);
    }
    static _onUpdateActiveEffect(effect, _changed, _options, _userId) {
      // Effects can be embedded on the actor directly, or on an item owned by the actor.
      // Either way, check whether they ultimately belong to the current actor.
      const parentActor = effect.parent?.parent ?? effect.parent;
      if (parentActor === this.currentActor) this._render();
    }
  }

  // Token-selection-driven display now goes through minisheet-pin.js's
  // shared controlToken listener (see its own header comment) instead of a
  // listener bound here — that's what lets the toggle button gate display
  // and lets a pinned actor take over with no token controlled at all.
  Hooks.on("updateActor", CharacterMiniSheet._onUpdateActor.bind(CharacterMiniSheet));
  Hooks.on("updateItem", CharacterMiniSheet._onUpdateItem.bind(CharacterMiniSheet));
  Hooks.on("updateActiveEffect", CharacterMiniSheet._onUpdateActiveEffect.bind(CharacterMiniSheet));

  Hooks.on("renderSleekCharacterSheet", (app) => {
    if (app.actor === CharacterMiniSheet.currentActor) {
      CharacterMiniSheet._teardown();
    }
  });

  Hooks.on("closeSleekCharacterSheet", () => syncPinnedMinisheet());

  _characterMiniSheetRef = CharacterMiniSheet;
}
