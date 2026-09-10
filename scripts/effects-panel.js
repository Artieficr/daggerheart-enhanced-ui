/**
 * Effects & Conditions bar — the icon row shown above the Character/
 * Companion/Adversary minisheets, left-aligned above the portrait (Party and
 * Environment actors have no per-actor effects concept, so they don't get
 * one). Active effects/conditions render first (effects from features, then
 * status effects), followed by disabled ones dimmed at the end of the row —
 * one continuous row, not a separate "nothing to show" state. Effects
 * (features) render as rounded-square tiles, since their art isn't designed
 * to stand alone the way condition icons are; status effects render as bare
 * icons — already clean on their own.
 *
 * Interaction: left-click the row toggles a slide-up detail panel (closes on
 * any outside click, not just its own toggle). Right-click an icon directly:
 * a feature effect toggles disabled/enabled; a status effect/condition is
 * deleted outright, matching the muscle memory of Foundry's own token HUD.
 *
 * This supersedes the daggerheart system's own #effects-display tray for
 * these three minisheet types (still relocated into the minisheet by each
 * minisheet file's _mountEffectsDisplay — untouched, since that relocation
 * has its own delicate hidden-attribute/MutationObserver handling — but now
 * hidden via CSS in favor of this bar, which adds the category split and a
 * click-to-open detail panel the native tray doesn't have).
 *
 * Reuses card-effects.hbs (the same partial the full sheets' own Effects tab
 * uses) for the slide-up panel, and attachFavoritesListeners for card
 * expand-on-click — the same "don't build a second rendering path" approach
 * inventory-panel.js takes.
 */
import { prepareActorEffectsData, isStatusEffectData } from "./helpers.js";
import { attachFavoritesListeners } from "./sheets/minisheets/utils-minisheet.js";

const MODULE_ID = "daggerheart-enhanced-ui";

let _outsideClickBound = false;

export function registerEffectsSettings() {
  // Deliberately config:false — this is remembered open/closed state, not a
  // user-facing setting, same as inventoryOpen/cardHandOpen.
  game.settings.register(MODULE_ID, "effectsOpen", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  _ensureOutsideClickListener();
}

export function getEffectsOpenState() {
  return game.settings.get(MODULE_ID, "effectsOpen");
}

export function setEffectsOpenState(value) {
  game.settings.set(MODULE_ID, "effectsOpen", !!value);
}

/**
 * Closes any open effects panel when a click lands outside both the panel
 * and its own toggling bar — a normal popover, not a persistent HUD element
 * like Inventory/Hand. Bound on the CAPTURE phase (the `true` third arg),
 * not the default bubble phase: several other minisheet click handlers
 * (e.g. the Features tab-button toggle) call event.stopPropagation(), which
 * would otherwise stop a bubble-phase document listener from ever seeing
 * those clicks at all — capture runs first, before any of that, so this
 * always sees every click regardless of what a target's own handler does
 * with propagation afterward (without this, clicking Features while the
 * effects panel was open left it stuck open).
 */
function _ensureOutsideClickListener() {
  if (_outsideClickBound) return;
  _outsideClickBound = true;

  document.addEventListener(
    "click",
    (event) => {
      let closedAny = false;

      document.querySelectorAll(".effects-window.active").forEach((windowEl) => {
        if (windowEl.contains(event.target)) return;
        const barContainer = windowEl.closest(".minisheet")?.querySelector(".effects-bar-container");
        if (barContainer?.contains(event.target)) return;

        windowEl.classList.remove("active");
        barContainer?.querySelector(".effects-bar")?.classList.remove("active");
        closedAny = true;
      });

      if (closedAny) setEffectsOpenState(false);
    },
    true,
  );
}

async function buildEffectsContext(actor) {
  const { activeEffects, inactiveEffects } = await prepareActorEffectsData(actor);

  const activeNonStatus = activeEffects.filter((e) => !isStatusEffectData(e));
  const activeStatus = activeEffects.filter(isStatusEffectData);
  const inactiveNonStatus = inactiveEffects.filter((e) => !isStatusEffectData(e));
  const inactiveStatus = inactiveEffects.filter(isStatusEffectData);

  return {
    // Panel sections fold active+inactive together — card-effects.hbs itself
    // dims a disabled entry (see components.css's .card-wrapper.inactive),
    // so there's no need for the panel to split them into their own headers.
    effects: [...activeNonStatus, ...inactiveNonStatus],
    statusEffects: [...activeStatus, ...inactiveStatus],
    // The bar renders as TWO separate groups, not one row in a single
    // order: active ones left-anchored, disabled ones in their own group
    // pinned to the right edge of the minisheet (margin-left:auto in CSS) —
    // not just "later in the same row," which only reads as "further right
    // than the active icons happen to end," not "grouped at the right side."
    barActiveEffects: activeNonStatus,
    barActiveStatusEffects: activeStatus,
    barInactiveEffects: inactiveNonStatus,
    barInactiveStatusEffects: inactiveStatus,
    hasActiveAny: activeNonStatus.length + activeStatus.length > 0,
    hasInactiveAny: inactiveNonStatus.length + inactiveStatus.length > 0,
    hasAny: activeNonStatus.length + activeStatus.length + inactiveNonStatus.length + inactiveStatus.length > 0,
    ownershipLevel: game.user.isGM ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : actor.getUserLevel(game.user),
  };
}

/**
 * Applies the right-click action, then immediately re-renders THIS bar/panel
 * directly rather than waiting for the updateActiveEffect/deleteActiveEffect
 * hook to do it. Not just about speed: each minisheet's own hook handler
 * calls a FULL _render() (portrait, resources, every tab window — the whole
 * minisheet), which still needs to happen for other clients and other
 * triggers (e.g. a status applied via the token HUD), but is unnecessarily
 * expensive for updating just the effects bar/panel after an action this
 * client already knows the outcome of. This targeted call is cheap by
 * comparison — only touches .effects-bar-container/.effects-window.
 */
async function _onBarContextMenu(event, minisheetElement, actor) {
  event.preventDefault();
  const iconEl = event.target.closest("[data-item-uuid]");
  if (!iconEl) return;

  const effect = await fromUuid(iconEl.dataset.itemUuid);
  if (!effect) return;

  if (iconEl.dataset.effectKind === "status") {
    await effect.delete();
  } else {
    await effect.update({ disabled: !effect.disabled });
  }

  renderEffectsPanel(minisheetElement, actor);
}

/**
 * Renders both the always-visible icon row and the slide-up detail panel
 * from a single effects computation, and (re)wires their listeners. No-ops
 * for any piece a given minisheet template doesn't render.
 */
export async function renderEffectsPanel(minisheetElement, actor) {
  if (!minisheetElement || !actor) return;

  const barContainer = minisheetElement.querySelector(".effects-bar-container");
  const windowEl = minisheetElement.querySelector(".effects-window");
  if (!barContainer && !windowEl) return;

  const context = await buildEffectsContext(actor);
  if (!minisheetElement.isConnected) return;

  // Nothing to show, active or inactive — never leave a stranded "no
  // effects" panel open with no bar left to close it from.
  if (!context.hasAny && getEffectsOpenState()) setEffectsOpenState(false);
  const isOpen = context.hasAny && getEffectsOpenState();

  if (barContainer) {
    const barHtml = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-enhanced-ui/templates/components/effects-bar.hbs", context);
    barContainer.innerHTML = barHtml;

    // Two separate groups now (active left-anchored, disabled right-
    // anchored — see effects-bar.hbs) — both open/highlight the same panel
    // and support the same right-click actions.
    barContainer.querySelectorAll(".effects-bar").forEach((bar) => {
      bar.classList.toggle("active", isOpen);
      bar.addEventListener("click", () => {
        const target = minisheetElement.querySelector(".effects-window");
        if (!target) return;
        const nextActive = !target.classList.contains("active");
        target.classList.toggle("active", nextActive);
        barContainer.querySelectorAll(".effects-bar").forEach((b) => b.classList.toggle("active", nextActive));
        setEffectsOpenState(nextActive);
      });
      bar.addEventListener("contextmenu", (event) => _onBarContextMenu(event, minisheetElement, actor));
    });
  }

  if (windowEl) {
    windowEl.classList.toggle("active", isOpen);

    const html = await foundry.applications.handlebars.renderTemplate("modules/daggerheart-enhanced-ui/templates/components/effects-panel.hbs", context);
    windowEl.innerHTML = html;

    attachFavoritesListeners(windowEl, actor, { isMinisheet: true });

    windowEl.querySelectorAll("[data-action='toggleEffect']").forEach((el) => {
      el.addEventListener("click", async (event) => {
        event.stopPropagation();
        const itemUuid = el.closest("[data-item-uuid]")?.dataset.itemUuid;
        const effect = itemUuid ? await fromUuid(itemUuid) : null;
        if (effect) await effect.update({ disabled: !effect.disabled });
        renderEffectsPanel(minisheetElement, actor);
      });
    });
  }
}
