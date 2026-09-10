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
  attachFavoritesListeners,
  attachReactionRollListeners,
  patchMinisheetTooltipManager,
  mountEffectsDisplay,
  unmountEffectsDisplay,
} from "./utils-minisheet.js";
import { applyMinisheetScale } from "../../settings.js";
import { injectMinisheetContainer, idleTransform, collapsedTransform } from "./minisheet-position.js";
import { toggleCardDescription } from "../../helpers.js";
import { renderEffectsPanel } from "../../effects-panel.js";

export function registerAdversaryMiniSheet() {
  if (game.system.id !== "daggerheart") return;
  if (!game.settings.get("daggerheart-enhanced-ui", "enableMinisheet")) return;

  class AdversaryMiniSheet {
    static currentActor = null;
    static element = null;
    static _tooltipPatched = false;
    static _effectsObserver = null;
    static _effectsOriginalParent = null;
    static _outsideClickListener = null;
    // Bumped at the top of every _render() call; checked again after each
    // await inside it so a slower, earlier-started render can't clobber a
    // faster, later-started one with stale data — see _render() below.
    static _renderGeneration = 0;

    // ─── TOOLTIP PATCH ────────────────────────────────────────────────────────

    static _patchTooltipManager() {
      patchMinisheetTooltipManager(this);
    }

    // ─── EFFECTS DISPLAY ─────────────────────────────────────────────────────

    static _mountEffectsDisplay() {
      mountEffectsDisplay(this, ".minisheet.adversary");
    }

    static _unmountEffectsDisplay() {
      unmountEffectsDisplay(this);
    }

    // ─── HOOKS ────────────────────────────────────────────────────────────────

    static _onControlToken(token, controlled) {
      if (!controlled) {
        if (!canvas.tokens?.controlled.length) AdversaryMiniSheet._teardown();
        return;
      }

      const actor = AdversaryMiniSheet._resolveActor();

      if (!actor) {
        AdversaryMiniSheet._teardown();
        return;
      }

      if (actor === AdversaryMiniSheet.currentActor) return;
      if (actor.sheet?.rendered) return;

      AdversaryMiniSheet.currentActor = actor;
      AdversaryMiniSheet._render();
    }

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
      // NOT `effect.parent?.parent ?? effect.parent` — that assumed a plain
      // Actor's own .parent is always undefined/falsy, true for a world
      // actor but NOT for an unlinked token's synthetic actor, whose
      // .parent returns the TokenDocument (always truthy). That silently
      // resolved parentActor to the TOKEN, not the actor, for every
      // unlinked-token adversary (confirmed via console: effectParentUuid
      // came back as "Scene.X.Token.Y", a token uuid with no ".Actor.Z"
      // segment, so it never matched currentActor). Checking the actual
      // type instead of truthiness fixes it regardless of token-linked/
      // unlinked or world-actor origin.
      const parentActor = effect.parent instanceof Actor ? effect.parent : effect.parent?.parent;
      if (parentActor?.uuid === this.currentActor?.uuid) this._render();
    }

    // ─── ACTOR RESOLUTION ────────────────────────────────────────────────────

    static _resolveActor() {
      const controlled = canvas.tokens?.controlled ?? [];
      if (controlled.length !== 1) return null;

      const token = controlled[0];
      const actor = token.actor;
      if (!actor || actor.type !== "adversary") return null;

      // GMs can always see adversaries; players need ownership
      const ownerLevel = game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : actor.getUserLevel(game.user);
      if (ownerLevel < CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return null;

      return actor;
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    static async _render() {
      if (!this.currentActor) return;

      // A status effect applied via the token HUD can fire multiple hooks
      // in quick succession (create/updateActiveEffect, possibly updateActor
      // too), each calling _render() — with nothing guarding against it, an
      // earlier-started call finishing its own awaits LAST would overwrite a
      // later, more current call's already-rendered result with stale data
      // (matches "doesn't show live, only after reopen" — reopening is a
      // single uncontested render, so the race never has a chance to bite).
      // Bump here, then bail out after each await below if a newer call has
      // already started.
      const generation = ++this._renderGeneration;

      // Preserve features window open state across re-renders
      const favWasActive = this.element?.querySelector(".favorites-window")?.classList.contains("active") ?? false;

      const effectsEl = document.getElementById("effects-display");
      const wasInMinisheet = effectsEl && this.element?.contains(effectsEl);
      if (wasInMinisheet) document.body.appendChild(effectsEl);

      const context = await this._prepareContext(this.currentActor);
      if (!this.currentActor || generation !== this._renderGeneration) return;

      const html = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-enhanced-ui/templates/sheets/adversaries/adversary-minisheet.hbs", context);
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

      if (favWasActive) {
        const favWindow = this.element.querySelector(".favorites-window");
        const tabBtn = this.element.querySelector(".tab-button");
        favWindow?.classList.add("active");
        tabBtn?.classList.add("active");
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

    // ─── CONTEXT ─────────────────────────────────────────────────────────────

    static async _prepareContext(actor) {
      // Reuse the system sheet's own _prepareContext so we get features,
      // enriched descriptions, usesData, fearCost, tags, etc. for free.
      const systemContext = await actor.sheet._prepareContext({});

      // Build attackDamage string
      const part = actor.system.attack.damage.main ?? actor.system.attack.damage.parts.hitPoints;
      const multiplier = part?.value.flatMultiplier ?? 1;
      const dice = part?.value.dice ?? "";
      const bonus = part?.value.bonus ?? 0;
      const attackDamage = `${multiplier}${dice}${bonus > 0 ? " + " + bonus : bonus < 0 ? bonus : ""}`;
      const attackDamageType = part ? [...part.type] : [];

      return {
        document: actor,
        source: actor,
        actor,
        isNPC: true,
        showTooltip: game.settings.get("daggerheart-enhanced-ui", "showTooltip"),
        currentFear: game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear),
        // Re-tagged isMinisheet:true — card-npc-features.hbs's header action
        // buttons are minisheet-only (the full sheet keeps its own copy in
        // .card-bottom .card-actions instead); this is the same array the
        // full sheet's own _prepareFeaturesData built, reused wholesale via
        // actor.sheet._prepareContext({}) above, so it needs re-tagging here
        // rather than at the source.
        adversaryFeatures: (systemContext.adversaryFeatures ?? []).map((f) => ({ ...f, isMinisheet: true })),
        attackDamage,
        attackDamageType,
        attack: actor.system.attack,
      };
    }

    // ─── LISTENERS ───────────────────────────────────────────────────────────

    static _attachListeners() {
      if (!this.element || !this.currentActor) return;

      const actor = this.currentActor;

      // Resource pips & modify buttons (shared utils handle the adversary paths fine)
      attachResourceListeners(this.element, actor);
      attachToggleResourceListeners(this.element, actor);
      attachReactionRollListeners(this.element, actor);

      // Open full sheet on portrait click
      this.element.querySelectorAll("[data-action='openSheet']").forEach((el) => {
        el.addEventListener("click", () => actor.sheet?.render(true));
      });

      // Actor attack — rolls damage via the system action workflow
      this.element.querySelectorAll("[data-action='useActorAttack']").forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const action = actor.system.attack;
          await action.use(event);
        });
      });

      // Actor attack damage roll (the damage chip in the attack card)
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

      // Card expand/collapse (feature cards show description on click)
      this._attachCardListeners();

      // Feature uses, simple/die/dice resources, item actions — delegated to the
      // same helpers that utils-minisheet exposes for favorites windows, since
      // the card markup is identical.
      attachFavoritesListeners(this.element, actor);

      // Features panel toggle (tab-button opens/closes the favorites-window)
      this.element.querySelectorAll(".tab-button").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const favWindow = this.element.querySelector(".favorites-window");
          const isActive = favWindow?.classList.contains("active");
          favWindow?.classList.toggle("active", !isActive);
          btn.classList.toggle("active", !isActive);
        });
      });

      // Close the features panel when clicking outside
      if (this._outsideClickListener) {
        document.removeEventListener("click", this._outsideClickListener);
      }

      this._outsideClickListener = (event) => {
        if (!this.element) return;
        const favWindow = this.element.querySelector(".favorites-window");
        if (!favWindow?.classList.contains("active")) return;
        if (!favWindow.contains(event.target) && !event.target.closest(".tab-button")) {
          favWindow.classList.remove("active");
          this.element.querySelector(".tab-button.active")?.classList.remove("active");
        }
      };

      document.addEventListener("click", this._outsideClickListener);
    }

    // Card expand/collapse for feature cards in the features panel.
    // Mirrors the logic in EnhancedAdversarySheet._attachCardListeners but without
    // needing to persist openCards across re-renders (minisheet re-renders fully).
    static _attachCardListeners() {
      this.element.querySelectorAll(".card-text, .card-resource").forEach((nameContainer) => {
        nameContainer.addEventListener("click", (event) => {
          if (event.target.closest('.card-controls, [data-action="useItem"], [data-action="useActorAttack"], [data-action="useAction"], .uses-resource, .actor-attack-roll, .simple-resource, .die-resource, .dice-resource')) return;

          const cardWrapper = nameContainer.closest(".card-wrapper");
          if (!cardWrapper) return;

          const description = cardWrapper.querySelector(".card-container.description");
          if (description) toggleCardDescription(description);
        });
      });
    }
  }

  // ─── HOOKS ─────────────────────────────────────────────────────────────────

  Hooks.on("controlToken", AdversaryMiniSheet._onControlToken.bind(AdversaryMiniSheet));
  Hooks.on("updateActor", AdversaryMiniSheet._onUpdateActor.bind(AdversaryMiniSheet));
  Hooks.on("updateItem", AdversaryMiniSheet._onUpdateItem.bind(AdversaryMiniSheet));
  // create/delete too — see the identical note in minisheet-character.js.
  Hooks.on("createActiveEffect", AdversaryMiniSheet._onUpdateActiveEffect.bind(AdversaryMiniSheet));
  Hooks.on("updateActiveEffect", AdversaryMiniSheet._onUpdateActiveEffect.bind(AdversaryMiniSheet));
  Hooks.on("deleteActiveEffect", AdversaryMiniSheet._onUpdateActiveEffect.bind(AdversaryMiniSheet));

  // Tear down when the full sheet opens for this actor
  Hooks.on("renderEnhancedAdversarySheet", (app) => {
    if (app.actor === AdversaryMiniSheet.currentActor) {
      AdversaryMiniSheet._teardown();
    }
  });

  // Re-mount when the full sheet is closed and the token is still selected
  Hooks.on("closeEnhancedAdversarySheet", (app) => {
    const actor = AdversaryMiniSheet._resolveActor();
    if (actor && app.actor === actor) {
      AdversaryMiniSheet.currentActor = actor;
      AdversaryMiniSheet._render();
    }
  });

  Hooks.on("updateSetting", (setting) => {
    if (setting.key !== `${CONFIG.DH.id}.${CONFIG.DH.SETTINGS.gameSettings.Resources.Fear}`) return;
    if (AdversaryMiniSheet.currentActor) AdversaryMiniSheet._render();
  });
}
