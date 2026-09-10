import {
  hideMacrobar,
  showMacrobar,
  collapseMinisheet,
  injectReopenButton,
  removeReopenButton,
  isMinisheetCollapsed,
  setMinisheetCollapsed,
  attachResourceListeners,
  attachToggleResourceListeners,
  attachActorPickerListeners,
  patchMinisheetTooltipManager,
  mountEffectsDisplay,
  unmountEffectsDisplay,
} from "./utils-minisheet.js";
import { applyMinisheetScale } from "../../settings.js";
import { injectMinisheetContainer, idleTransform, collapsedTransform } from "./minisheet-position.js";
import { buildActorPickerContext, syncPinnedMinisheet } from "./minisheet-pin.js";
import { renderEffectsPanel } from "../../effects-panel.js";

// Static-only class scoped inside registerCompanionMiniSheet()'s closure —
// module-scope reference needed so minisheet-pin.js's coordinator (and this
// file's own exported show/teardown entry points) can reach it. Mirrors
// minisheet-character.js's _characterMiniSheetRef.
let _companionMiniSheetRef = null;

export function showCompanionMiniSheetActor(actor) {
  if (!_companionMiniSheetRef) return;
  if (_companionMiniSheetRef.currentActor === actor && _companionMiniSheetRef.element) return;
  _companionMiniSheetRef.currentActor = actor;
  _companionMiniSheetRef._render();
}

export function teardownCompanionMiniSheet() {
  if (!_companionMiniSheetRef?.currentActor && !_companionMiniSheetRef?.element) return;
  _companionMiniSheetRef._teardown();
}

export function registerCompanionMiniSheet() {
  if (game.system.id !== "daggerheart") return;
  if (!game.settings.get("daggerheart-enhanced-ui", "enableMinisheet")) return;

  class CompanionMiniSheet {
    static currentActor = null;
    static element = null;
    static _tooltipPatched = false;
    static _effectsObserver = null;
    static _effectsOriginalParent = null;
    // See the identical, more detailed note in minisheet-adversary.js.
    static _renderGeneration = 0;

    // ─── TOOLTIP PATCH ────────────────────────────────────────────────────────

    static _patchTooltipManager() {
      patchMinisheetTooltipManager(this);
    }

    // ─── EFFECTS DISPLAY ─────────────────────────────────────────────────────

    static _mountEffectsDisplay() {
      mountEffectsDisplay(this, ".minisheet.companion");
    }

    static _unmountEffectsDisplay() {
      unmountEffectsDisplay(this);
    }

    // ─── HOOKS ────────────────────────────────────────────────────────────────

    static _onUpdateActor(actor) {
      if (actor?.uuid === this.currentActor?.uuid) this._render();
    }

    static _onUpdateItem(item) {
      // .uuid, not === — more robust against an unlinked token's synthetic
      // actor object potentially not being the same reference as
      // currentActor even when it's the same logical actor.
      if (item.parent?.uuid !== this.currentActor?.uuid) return;
      this._render();
    }

    static _onUpdateActiveEffect(effect) {
      // See the identical, detailed note in minisheet-adversary.js — a
      // plain truthiness fallback here silently resolves to the TOKEN
      // rather than the actor for any unlinked token.
      const parentActor = effect.parent instanceof Actor ? effect.parent : effect.parent?.parent;
      if (parentActor?.uuid === this.currentActor?.uuid) this._render();
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    static async _render() {
      if (!this.currentActor) return;
      const generation = ++this._renderGeneration;

      const effectsEl = document.getElementById("effects-display");
      const wasInMinisheet = effectsEl && this.element?.contains(effectsEl);
      if (wasInMinisheet) document.body.appendChild(effectsEl);

      const context = await this._prepareContext(this.currentActor);
      if (!this.currentActor || generation !== this._renderGeneration) return;

      const html = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-enhanced-ui/templates/sheets/companions/companion-minisheet.hbs", context);
      if (!this.currentActor || generation !== this._renderGeneration) return;

      if (!this.element) {
        this._injectContainer();
        hideMacrobar();
      }

      const scaleWrapper = this.element.querySelector(".minisheet-transform-wrapper");
      scaleWrapper.innerHTML = html;

      const collapsed = isMinisheetCollapsed();

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

            const hotbar = document.getElementById("hotbar");
            if (hotbar) {
              hotbar.style.transition = "none";
              hotbar.style.transform = `translateY(100%)`;
              hotbar.style.display = "";
              hotbar.offsetHeight;
              hotbar.style.transition = "transform 0.3s ease";
              hotbar.style.transform = `translateY(0)`;
            }
          });
        });
      }

      this._attachListeners();
      this._patchTooltipManager();
      renderEffectsPanel(this.element, this.currentActor);

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

    static _teardown() {
      this._unmountEffectsDisplay();
      removeReopenButton();

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

    // ─── CONTEXT ─────────────────────────────────────────────────────────────

    static async _prepareContext(actor) {
      const part = actor.system.attack.damage.main ?? actor.system.attack.damage.parts.hitPoints;
      const proficiency = actor.system.proficiency ?? 1;
      const dice = part?.value.dice ?? "";
      const bonus = part?.value.bonus ?? 0;
      const attackDamage = `${proficiency}${dice}${bonus > 0 ? " + " + bonus : bonus < 0 ? bonus : ""}`;
      const attackDamageType = part ? [...part.type] : [];

      const partnerRef = actor.system.partner;
      const partner = partnerRef ? (typeof partnerRef === "string" ? await fromUuid(partnerRef) : partnerRef) : null;

      return {
        document: actor,
        source: actor,
        actor,
        showTooltip: game.settings.get("daggerheart-enhanced-ui", "showTooltip"),
        partner,
        attack: actor.system.attack,
        attackDamage,
        attackDamageType,
        actorPicker: buildActorPickerContext(actor),
      };
    }

    // ─── LISTENERS ───────────────────────────────────────────────────────────

    static _attachListeners() {
      if (!this.element || !this.currentActor) return;

      const actor = this.currentActor;

      attachResourceListeners(this.element, actor);
      attachToggleResourceListeners(this.element, actor);
      attachActorPickerListeners(this.element);

      // Open full sheet on portrait click
      this.element.querySelectorAll("[data-action='openSheet']").forEach((el) => {
        el.addEventListener("click", () => actor.sheet?.render(true));
      });

      // Action roll — needs the partner to call diceRoll, mirrors system's #actionRoll
      this.element.querySelectorAll("[data-action='actionRoll']").forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.stopPropagation();
          const partnerRef = actor.system.partner;
          const partner = partnerRef ? (typeof partnerRef === "string" ? await fromUuid(partnerRef) : partnerRef) : null;
          if (!partner) return;

          const config = {
            event,
            title: `${game.i18n.localize("DAGGERHEART.GENERAL.Roll.action")}: ${actor.name}`,
            headerTitle: `Companion ${game.i18n.localize("DAGGERHEART.GENERAL.Roll.action")}`,
            roll: {
              trait: partner.system.spellcastModifierTrait?.key,
              companionRoll: true,
            },
            hasRoll: true,
          };

          const result = await partner.diceRoll(config);

          // Consume resources from the partner, mirroring system's consumeResource
          if (result?.costs?.length) {
            const usefulResources = {
              ...foundry.utils.deepClone(partner.system.resources),
              fear: {
                value: game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear),
                max: game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Homebrew).maxFear,
                reversed: false,
              },
            };
            const resources = game.system.api.fields.ActionFields.CostField.getRealCosts(result.costs).map((c) => {
              const resource = usefulResources[c.key];
              return {
                key: c.key,
                value: (c.total ?? c.value) * (resource.isReversed ? 1 : -1),
                target: resource.target,
              };
            });
            await partner.modifyResource(resources);
          }
        });
      });

      // Attack damage roll
      this.element.querySelectorAll(".actor-attack-roll").forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const action = actor.system.attack;
          const config = action.prepareConfig(event);
          config.effects = await game.system.api.data.actions.actionsTypes.base.getActionRelevantEffects(actor, null);
          config.hasRoll = false;
          action.workflow.get("damage").execute(config, null, true);
        });
      });

      // Attack action card
      this.element.querySelectorAll("[data-action='useActorAttack']").forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.stopPropagation();
          const action = actor.system.attack;
          await action.use(event);
        });
      });

      // Partner sheet
      this.element.querySelectorAll("[data-action='openPartnerSheet']").forEach((el) => {
        el.addEventListener("click", async () => {
          const partnerRef = actor.system.partner;
          const partner = partnerRef ? (typeof partnerRef === "string" ? await fromUuid(partnerRef) : partnerRef) : null;
          if (!partner) return;
          partner.sheet?.render(true);
        });
      });
    }
  }

  // ─── HOOKS ─────────────────────────────────────────────────────────────────

  // Token-selection-driven display goes through minisheet-pin.js's shared
  // controlToken listener instead — see minisheet-character.js's identical
  // note and minisheet-pin.js's own header comment.
  Hooks.on("updateActor", CompanionMiniSheet._onUpdateActor.bind(CompanionMiniSheet));
  Hooks.on("updateItem", CompanionMiniSheet._onUpdateItem.bind(CompanionMiniSheet));
  // create/delete too — see the identical note in minisheet-character.js.
  Hooks.on("createActiveEffect", CompanionMiniSheet._onUpdateActiveEffect.bind(CompanionMiniSheet));
  Hooks.on("updateActiveEffect", CompanionMiniSheet._onUpdateActiveEffect.bind(CompanionMiniSheet));
  Hooks.on("deleteActiveEffect", CompanionMiniSheet._onUpdateActiveEffect.bind(CompanionMiniSheet));

  Hooks.on("renderEnhancedCompanionSheet", (app) => {
    if (app.actor === CompanionMiniSheet.currentActor) {
      CompanionMiniSheet._teardown();
    }
  });

  Hooks.on("closeEnhancedCompanionSheet", () => syncPinnedMinisheet());

  _companionMiniSheetRef = CompanionMiniSheet;
}
