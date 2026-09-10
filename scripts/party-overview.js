/**
 * Party Overview widget — a small, always-on, GM-only HUD showing every
 * party member's HP, Stress, and portrait at a glance (not tied to token
 * selection, unlike the Party Mini Sheet). Draggable anywhere on screen
 * (drag handle + lock toggle revealed on hover), position/lock state
 * persisted per-client via partyOverviewPosition/partyOverviewLocked.
 * Layout (horizontal columns vs. vertical rows) via partyOverviewLayout.
 *
 * Owns its own settings (registerPartyOverviewSettings/
 * registerPartyOverviewSettingsUI), same shape as card-hand.js/
 * inventory-panel.js — not settings.js. Kept in this file specifically so
 * partyOverviewLayout's onChange can call straight into the live widget
 * instance (`activeInstance`) without a cross-file export just for that.
 *
 * MVP simplification: resolves "the party" as the first actor of type
 * "party" found in the world (`resolvePartyActor`). Most worlds only ever
 * have one; if that stops being true for this table, this is the one place
 * to add a picker.
 */
import { getBeastformPortrait } from "./helpers.js";
import { attachHudDragHandle } from "./hud-drag.js";

const MODULE_ID = "daggerheart-enhanced-ui";
const TEMPLATE = "modules/daggerheart-enhanced-ui/templates/sheets/party/party-overview.hbs";

// Set once registerPartyOverview() builds the class, so settings onChange
// handlers (registered separately, at init, before this exists) can reach
// the live instance without a full page reload.
let activeInstance = null;

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export function registerPartyOverviewSettings() {
  // GM-only feature, so client scope (same reasoning as enableMinisheet);
  // requiresReload keeps this in line with that setting too, rather than
  // wiring a live mount/teardown path.
  game.settings.register(MODULE_ID, "enablePartyOverview", {
    name: "Enable Party Overview Widget",
    hint: "Shows a small draggable HUD (GM only) with each party member's HP, Stress, and portrait",
    requiresReload: true,
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "partyOverviewLayout", {
    name: "Party Overview Layout",
    hint: "Horizontal: one column per member. Vertical: one row per member.",
    scope: "client",
    config: true,
    type: String,
    choices: { horizontal: "Horizontal (columns)", vertical: "Vertical (rows)" },
    default: "horizontal",
    // Pure CSS toggle — apply immediately against the live widget instead
    // of requiring a reload.
    onChange: () => activeInstance?._render(),
  });

  // Remembered drag position — anchored bottom-left, same as the minisheet,
  // but offset up so its default spot sits above it rather than overlapping.
  game.settings.register(MODULE_ID, "partyOverviewPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: { left: 0, bottom: 250 },
  });

  game.settings.register(MODULE_ID, "partyOverviewLocked", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
}

/**
 * Foundry has no built-in "only show this setting when another setting has
 * a given value" field — hides partyOverviewLayout's own .form-group when
 * enablePartyOverview is unchecked, keyed off the checkbox's live (not just
 * saved) state. Same pattern as card-hand.js's
 * applyFavoritesDisplayModeVisibility.
 */
function applyPartyOverviewSettingsVisibility(rootEl) {
  const root = rootEl ?? document;
  const enableCheckbox = root.querySelector(`input[name="${MODULE_ID}.enablePartyOverview"]`);
  const layoutRow = root.querySelector(`select[name="${MODULE_ID}.partyOverviewLayout"]`)?.closest(".form-group");
  if (!enableCheckbox || !layoutRow) return;

  layoutRow.style.display = enableCheckbox.checked ? "" : "none";
}

export function registerPartyOverviewSettingsUI() {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    applyPartyOverviewSettingsVisibility(root);

    const enableCheckbox = root.querySelector(`input[name="${MODULE_ID}.enablePartyOverview"]`);
    enableCheckbox?.addEventListener("change", () => applyPartyOverviewSettingsVisibility(root));
  });
}

// ─── WIDGET ──────────────────────────────────────────────────────────────────

export function registerPartyOverview() {
  if (game.system.id !== "daggerheart") return;
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "enablePartyOverview")) return;

  class PartyOverview {
    static element = null;

    // ─── RESOLUTION ──────────────────────────────────────────────────────────

    static _resolvePartyActor() {
      return game.actors?.find((a) => a.type === "party") ?? null;
    }

    // ─── RENDER ──────────────────────────────────────────────────────────────

    static async _render() {
      const party = this._resolvePartyActor();

      const context = party
        ? await this._prepareContext(party)
        : { members: [], noParty: true, locked: game.settings.get(MODULE_ID, "partyOverviewLocked") };

      const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE, context);

      if (!this.element) this._injectContainer();

      this.element.innerHTML = html;
      this.element.classList.toggle("locked", context.locked);

      const layout = game.settings.get(MODULE_ID, "partyOverviewLayout");
      this.element.classList.remove("layout-horizontal", "layout-vertical");
      this.element.classList.add(`layout-${layout}`);

      this._applyPosition();
      this._attachListeners();
    }

    static _teardown() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }

    static _injectContainer() {
      const el = document.createElement("div");
      el.id = "party-overview-widget";
      // Set inline, not left to party-overview.css alone — if that stylesheet
      // fails to load for any reason, an unpositioned div appended straight
      // to <body> can disrupt Foundry's own UI layout instead of just
      // failing to render. Matches minisheet-position.js's containerStyleFor().
      el.style.cssText = "position:fixed;z-index:60;";
      document.body.appendChild(el);
      this.element = el;
    }

    static _applyPosition() {
      const pos = game.settings.get(MODULE_ID, "partyOverviewPosition");
      this.element.style.left = `${pos.left}px`;
      this.element.style.bottom = `${pos.bottom}px`;
    }

    // ─── CONTEXT ─────────────────────────────────────────────────────────────

    static async _prepareContext(party) {
      const members = [...(party.system.partyMembers ?? [])]
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((member) => {
          const sys = member.system;
          return {
            actorUuid: member.uuid,
            name: member.name,
            img: getBeastformPortrait(member) || member.img,
            hitPointsValue: sys.resources?.hitPoints?.value ?? 0,
            hitPointsMax: sys.resources?.hitPoints?.max ?? 0,
            stressValue: sys.resources?.stress?.value ?? 0,
            stressMax: sys.resources?.stress?.max ?? 0,
          };
        });

      return {
        members,
        locked: game.settings.get(MODULE_ID, "partyOverviewLocked"),
      };
    }

    // ─── LISTENERS ───────────────────────────────────────────────────────────

    static _attachListeners() {
      if (!this.element) return;

      this.element.querySelectorAll("[data-action='openMemberSheet']").forEach((el) => {
        el.addEventListener("click", async () => {
          const uuid = el.dataset.actorUuid;
          if (!uuid) return;
          const member = await fromUuid(uuid);
          if (!member) return;

          const token = canvas.tokens?.placeables.find((t) => t.actor === member);
          if (token) {
            token.control({ releaseOthers: true });
            canvas.animatePan({ x: token.x, y: token.y });
          } else {
            member.sheet?.render(true);
          }
        });
      });

      const dragHandle = this.element.querySelector(".po-drag-handle");
      if (dragHandle) {
        attachHudDragHandle(dragHandle, this.element, {
          getLocked: () => game.settings.get(MODULE_ID, "partyOverviewLocked"),
          onDragEnd: (pos) => game.settings.set(MODULE_ID, "partyOverviewPosition", pos),
        });
      }

      const lockToggle = this.element.querySelector(".po-lock-toggle");
      if (lockToggle) {
        lockToggle.addEventListener("click", async () => {
          const locked = game.settings.get(MODULE_ID, "partyOverviewLocked");
          await game.settings.set(MODULE_ID, "partyOverviewLocked", !locked);
          this._render();
        });
      }
    }

    // ─── CHANGE DETECTION ────────────────────────────────────────────────────

    static _onActorChange(actor) {
      const party = this._resolvePartyActor();
      if (!party) return;
      if (actor === party || party.system.partyMembers?.some((m) => m === actor)) this._render();
    }
  }

  activeInstance = PartyOverview;
  PartyOverview._render();

  Hooks.on("updateActor", (actor) => PartyOverview._onActorChange(actor));
  Hooks.on("updateItem", (item) => {
    if (item.parent) PartyOverview._onActorChange(item.parent);
  });
  Hooks.on("updateActiveEffect", (effect) => {
    const actor = effect.parent?.parent ?? effect.parent;
    if (actor) PartyOverview._onActorChange(actor);
  });
  Hooks.on("createActor", (actor) => {
    if (actor.type === "party") PartyOverview._render();
  });
  Hooks.on("deleteActor", (actor) => {
    if (actor.type === "party") PartyOverview._render();
  });
}
