/**
 * Countdown Tracker — a modern, draggable replacement for Foundryborne's own
 * countdown tracker UI, ported from CPTN Cosmo's Improved Countdowns
 * (https://git.geeks.gay/cosmo/dh-improved-countdowns, MIT — see LICENSE)
 * and restyled to match Enhanced UI's own design tokens instead of the
 * original's bespoke dark-glass palette. Functionality (drag, lock,
 * minimize, per-countdown increment/decrement, add-new, all the visual
 * customization settings) is preserved as-is; only presentation and the
 * settings-registration/visibility-toggle plumbing were adapted to this
 * module's own conventions (module id, settings ownership shape, vanilla
 * DOM instead of jQuery for the renderSettingsConfig visibility toggling).
 *
 * Data source is the Daggerheart system's own world setting
 * (`game.settings.get("daggerheart", "Countdowns")`) and system API
 * (`game.system.api.applications.ui.CountdownEdit`/`DhCountdowns`) — a
 * system integration point, not tied to the original module's namespace,
 * so that part ports unchanged.
 */
const MODULE_ID = "daggerheart-enhanced-ui";
const TEMPLATE = "modules/daggerheart-enhanced-ui/templates/countdown-tracker.hbs";

/* ====================
   SETTINGS
   ==================== */

export function registerCountdownTrackerSettings() {
  game.settings.register(MODULE_ID, "countdownPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: { left: 0, bottom: 380 },
  });

  game.settings.register(MODULE_ID, "countdownLocked", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownMinimized", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownDisplayMode", {
    name: "Countdown Tracker: Display Mode",
    hint: "Choose how the countdown value is displayed.",
    scope: "world",
    config: true,
    type: String,
    choices: { number: "Number Only", visual: "Visual Only", both: "Visual + Number" },
    default: "number",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownIconShape", {
    name: "Countdown Tracker: Icon Shape",
    hint: "Choose the shape of the countdown icons.",
    scope: "client",
    config: true,
    type: String,
    choices: { rounded: "Rounded Square", circle: "Circle" },
    default: "rounded",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownNumberColor", {
    name: "Countdown Tracker: Number Color",
    hint: "Color for the numerical text.",
    scope: "client",
    config: true,
    type: String,
    default: "#efe6d8",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownBarOrientation", {
    name: "Countdown Tracker: Bar Orientation",
    hint: "Choose the orientation of the progress bar (for square icons).",
    scope: "client",
    config: true,
    type: String,
    choices: { vertical: "Vertical", horizontal: "Horizontal" },
    default: "vertical",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownEnableVisualOverlay", {
    name: "Countdown Tracker: Enable Fill Overlay",
    hint: "Show the filled progress overlay (Bar or Clock).",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownFillType", {
    name: "Countdown Tracker: Fill Type",
    hint: "Choose between a color overlay or a grayscale filter method.",
    scope: "client",
    config: true,
    type: String,
    choices: { color: "Color Overlay", grayscale: "Grayscale Filter" },
    default: "color",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownInvertProgress", {
    name: "Countdown Tracker: Invert Fill Overlay",
    hint: "Fill the empty space instead of the current value.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownFillColor", {
    name: "Countdown Tracker: Fill Overlay Color",
    hint: "Color for the filled progress overlay.",
    scope: "client",
    config: true,
    type: String,
    default: "#f3c267",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownEnableVisualBorder", {
    name: "Countdown Tracker: Enable Border Progress",
    hint: "Show a progress border around the icon.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownInvertBorder", {
    name: "Countdown Tracker: Invert Border Progress",
    hint: "Fill the empty space instead of the current value for the border.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownBorderStyle", {
    name: "Countdown Tracker: Border Style",
    hint: "Choose the style of the progress border (for square icons).",
    scope: "client",
    config: true,
    type: String,
    choices: { full: "Full Border", edge: "Single Edge" },
    default: "full",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownBorderEdge", {
    name: "Countdown Tracker: Border Edge",
    hint: "Choose which edge to display the border on.",
    scope: "client",
    config: true,
    type: String,
    choices: { bottom: "Bottom", top: "Top", left: "Left", right: "Right" },
    default: "bottom",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownBorderColor", {
    name: "Countdown Tracker: Border Color",
    hint: "Color for the progress border.",
    scope: "client",
    config: true,
    type: String,
    default: "#f3c267",
    onChange: () => CountdownTrackerApp.instance?.render(),
  });

  game.settings.register(MODULE_ID, "countdownGmAlwaysShowNumbers", {
    name: "Countdown Tracker: GM Always Shows Numbers",
    hint: "If enabled, the GM will always see the numerical value even if Display Mode is set to Visual.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => CountdownTrackerApp.instance?.render(),
  });
}

/**
 * Same "hide a setting's .form-group based on another setting's live value"
 * need as card-hand.js's applyFavoritesDisplayModeVisibility/party-overview.js's
 * applyPartyOverviewSettingsVisibility — ported from the original module's
 * jQuery-based renderSettingsConfig hook to this module's vanilla-DOM
 * pattern instead, same show/hide dependency logic.
 */
function applyCountdownSettingsVisibility(rootEl) {
  const root = rootEl ?? document;
  const getGroup = (name) => root.querySelector(`[name="${MODULE_ID}.${name}"]`)?.closest(".form-group");

  const displayModeInput = root.querySelector(`[name="${MODULE_ID}.countdownDisplayMode"]`);
  const enableOverlayInput = root.querySelector(`[name="${MODULE_ID}.countdownEnableVisualOverlay"]`);
  const enableBorderInput = root.querySelector(`[name="${MODULE_ID}.countdownEnableVisualBorder"]`);
  const fillTypeInput = root.querySelector(`[name="${MODULE_ID}.countdownFillType"]`);
  const borderStyleInput = root.querySelector(`[name="${MODULE_ID}.countdownBorderStyle"]`);
  if (!displayModeInput) return;

  const numberColorGroup = getGroup("countdownNumberColor");
  const enableOverlayGroup = getGroup("countdownEnableVisualOverlay");
  const enableBorderGroup = getGroup("countdownEnableVisualBorder");
  const fillTypeGroup = getGroup("countdownFillType");
  const invertProgressGroup = getGroup("countdownInvertProgress");
  const fillColorGroup = getGroup("countdownFillColor");
  const barOrientationGroup = getGroup("countdownBarOrientation");
  const invertBorderGroup = getGroup("countdownInvertBorder");
  const borderColorGroup = getGroup("countdownBorderColor");
  const borderStyleGroup = getGroup("countdownBorderStyle");
  const borderEdgeGroup = getGroup("countdownBorderEdge");

  const show = (el, visible) => { if (el) el.style.display = visible ? "" : "none"; };

  const displayMode = displayModeInput.value;
  const showVisualSettings = displayMode === "visual" || displayMode === "both";
  const showNumberSettings = displayMode === "number" || displayMode === "both";

  show(numberColorGroup, showNumberSettings);
  show(enableOverlayGroup, showVisualSettings);
  show(enableBorderGroup, showVisualSettings);

  if (!showVisualSettings) {
    show(fillTypeGroup, false);
    show(invertProgressGroup, false);
    show(fillColorGroup, false);
    show(barOrientationGroup, false);
    show(invertBorderGroup, false);
    show(borderColorGroup, false);
    show(borderStyleGroup, false);
    show(borderEdgeGroup, false);
    return;
  }

  const overlayEnabled = enableOverlayInput?.checked;
  const borderEnabled = enableBorderInput?.checked;

  show(fillTypeGroup, !!overlayEnabled);
  show(invertProgressGroup, !!overlayEnabled);
  show(barOrientationGroup, !!overlayEnabled);
  show(fillColorGroup, !!overlayEnabled && fillTypeInput?.value !== "grayscale");

  show(invertBorderGroup, !!borderEnabled);
  show(borderColorGroup, !!borderEnabled);
  show(borderStyleGroup, !!borderEnabled);
  show(borderEdgeGroup, !!borderEnabled && borderStyleInput?.value === "edge");
}

export function registerCountdownTrackerSettingsUI() {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    applyCountdownSettingsVisibility(root);

    ["countdownDisplayMode", "countdownFillType", "countdownBorderStyle", "countdownEnableVisualOverlay", "countdownEnableVisualBorder"].forEach((name) => {
      root.querySelector(`[name="${MODULE_ID}.${name}"]`)?.addEventListener("change", () => applyCountdownSettingsVisibility(root));
    });
  });
}

/* ====================
   WIDGET
   ==================== */

let CountdownTrackerApp;

export function registerCountdownTracker() {
  if (game.system.id !== "daggerheart") return;

  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  CountdownTrackerApp = class CountdownTrackerApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static instance;

    constructor(options = {}) {
      super(options);
      this._dragData = {
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startBottom: 0,
        width: 0,
        height: 0,
      };
      // Bound once and reused for both addEventListener and
      // removeEventListener — binding fresh in each call (as the original
      // module's own code does) produces a different function reference
      // every time, so removeEventListener never actually matches what was
      // added and the mousemove/mouseup listeners silently pile up on
      // window with every drag.
      this._onDraggingBound = this.#onDragging.bind(this);
      this._onDragEndBound = this.#onDragEnd.bind(this);

      // Every re-render (e.g. clicking +/- edits the countdown setting,
      // which fires DhRefresh, which re-renders this whole app) replaces
      // .countdown-tracker-window with a brand new element, dropping
      // native :hover for a frame even though the cursor never moved —
      // that's what made the header/controls visibly close and reopen on
      // every click. Tracked here (not via mouseenter, which won't fire
      // for a stationary cursor over newly-inserted content) so _onRender
      // can synchronously re-apply the open state before paint.
      this._lastMouseX = -1;
      this._lastMouseY = -1;
      this._trackMouseBound = (e) => {
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
      };
      window.addEventListener("mousemove", this._trackMouseBound);
    }

    // positioned:false opts out of Foundry's own top/left window-position
    // management entirely (the system's own default DhCountdowns tracker
    // class — the one we hide via CSS — does the same) so this app can be
    // bottom-anchored instead, same as Party Overview: #applyPosition sets
    // left/bottom directly, and growth (the header reveal) then happens
    // away from the pinned bottom edge with no transform/reordering tricks
    // needed at all.
    static DEFAULT_OPTIONS = {
      id: "enhanced-ui-countdown-tracker",
      tag: "div",
      classes: ["enhanced-ui-countdown-tracker"],
      window: { frame: false, positioned: false },
      actions: {
        increaseCountdown: CountdownTrackerApp.#onIncrease,
        decreaseCountdown: CountdownTrackerApp.#onDecrease,
        addCountdown: CountdownTrackerApp.#onAdd,
        toggleViewMode: CountdownTrackerApp.#onToggleView,
        toggleLock: CountdownTrackerApp.#onToggleLock,
      },
    };

    static PARTS = {
      content: { template: TEMPLATE },
    };

    static initialize() {
      this.instance = new CountdownTrackerApp();
      this.instance.render(true);
    }

    #applyPosition() {
      const pos = game.settings.get(MODULE_ID, "countdownPosition");
      // Fallback for a position stored before this widget switched from
      // top-anchored to bottom-anchored positioning (2026-09-09) — a
      // stale {top,left} object has no .bottom, which would otherwise
      // leave `bottom` unset entirely.
      this.element.style.left = `${pos.left ?? 0}px`;
      this.element.style.bottom = `${pos.bottom ?? 380}px`;
    }

    async _prepareContext(_options) {
      const isGM = game.user.isGM;
      const isMinimized = game.settings.get(MODULE_ID, "countdownMinimized");
      const isLocked = game.settings.get(MODULE_ID, "countdownLocked");
      const iconShape = game.settings.get(MODULE_ID, "countdownIconShape");
      const displayMode = game.settings.get(MODULE_ID, "countdownDisplayMode");
      const barOrientation = game.settings.get(MODULE_ID, "countdownBarOrientation");
      const enableVisualOverlay = game.settings.get(MODULE_ID, "countdownEnableVisualOverlay");
      const fillType = game.settings.get(MODULE_ID, "countdownFillType");
      const invertProgress = game.settings.get(MODULE_ID, "countdownInvertProgress");
      const numberColor = game.settings.get(MODULE_ID, "countdownNumberColor");
      const fillColor = game.settings.get(MODULE_ID, "countdownFillColor");
      const enableVisualBorder = game.settings.get(MODULE_ID, "countdownEnableVisualBorder");
      const invertBorder = game.settings.get(MODULE_ID, "countdownInvertBorder");
      const borderColor = game.settings.get(MODULE_ID, "countdownBorderColor");
      const borderStyle = game.settings.get(MODULE_ID, "countdownBorderStyle");
      const borderEdge = game.settings.get(MODULE_ID, "countdownBorderEdge");
      const gmAlwaysShowNumbers = game.settings.get(MODULE_ID, "countdownGmAlwaysShowNumbers");

      const showNumbers = (isGM && gmAlwaysShowNumbers) || displayMode === "number" || displayMode === "both";
      const showVisuals = displayMode === "visual" || displayMode === "both";

      const systemCountdownSetting = game.settings.get("daggerheart", "Countdowns");
      const countdowns = {};

      if (systemCountdownSetting && systemCountdownSetting.countdowns) {
        for (const [id, countdown] of Object.entries(systemCountdownSetting.countdowns)) {
          const ownership = this.#getPlayerOwnership(game.user, systemCountdownSetting, countdown);
          if (ownership !== CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) {
            const current = countdown.progress.current;
            const max = countdown.progress.start;
            const percentage = Math.max(0, Math.min(100, (current / max) * 100));
            const pctRemaining = 100 - percentage;

            countdowns[id] = {
              ...countdown,
              editable: isGM || ownership === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
              percentage,
              pctRemaining,
              cssClass: `shape-${iconShape}`,
            };
          }
        }
      }

      const hasCountdowns = Object.keys(countdowns).length > 0;

      return {
        countdowns,
        hasCountdowns,
        isGM,
        isMinimized,
        isLocked,
        showNumbers,
        showVisuals,
        iconShape,
        barOrientation,
        enableVisualOverlay,
        fillType,
        fillColor,
        enableVisualBorder,
        invertBorder,
        borderColor,
        borderStyle,
        borderEdge,
        invertProgress,
        numberColor,
      };
    }

    #getPlayerOwnership(user, setting, countdown) {
      const playerOwnership = countdown.ownership[user.id];
      return playerOwnership === undefined || playerOwnership === CONST.DOCUMENT_OWNERSHIP_LEVELS.INHERIT
        ? setting.defaultOwnership
        : playerOwnership;
    }

    // The system's own DhCountdowns.editCountdown(increase, target) reads the
    // countdown id off `target` itself via `target.closest('[data-countdown]')`
    // — it expects a real DOM element, not a plain {id} object. Passing {id}
    // (as the original ported code did) throws inside the system's own method
    // (`{id}.closest is not a function`) and silently does nothing from the
    // user's perspective. `target` here already IS the clicked element, and
    // the template gives it its own `data-countdown` attribute, so passing it
    // straight through satisfies that lookup directly.
    static async #onIncrease(event, target) {
      if (typeof game.system.api.applications.ui.DhCountdowns?.editCountdown === "function") {
        await game.system.api.applications.ui.DhCountdowns.editCountdown(true, target);
      }
    }

    static async #onDecrease(event, target) {
      if (typeof game.system.api.applications.ui.DhCountdowns?.editCountdown === "function") {
        await game.system.api.applications.ui.DhCountdowns.editCountdown(false, target);
      }
    }

    static async #onAdd() {
      if (!game.user.isGM) return;
      if (game.system.api.applications.ui.CountdownEdit) {
        new game.system.api.applications.ui.CountdownEdit().render(true);
      }
    }

    static async #onToggleView() {
      const current = game.settings.get(MODULE_ID, "countdownMinimized");
      await game.settings.set(MODULE_ID, "countdownMinimized", !current);
      CountdownTrackerApp.instance?.render();
    }

    static async #onToggleLock() {
      const current = game.settings.get(MODULE_ID, "countdownLocked");
      await game.settings.set(MODULE_ID, "countdownLocked", !current);
      CountdownTrackerApp.instance?.render();
    }

    _onRender(_context, _options) {
      this.#applyPosition();
      this.#setupDragging();
      this.#restoreHoverState();
    }

    /**
     * If the mouse is still physically over the freshly-rendered window
     * (its last known position falls within the new element's bounds),
     * force the hover-open state on instantly — before the browser gets a
     * chance to paint a frame with it collapsed — instead of waiting on
     * native :hover to notice a DOM node it's never seen before.
     * .force-open mirrors every :hover rule in countdown-tracker.css, but
     * merely adding it isn't enough on its own: a freshly-created element
     * still starts from its collapsed default, so without also suppressing
     * transitions for this one frame (.no-transition, removed again next
     * frame), it would visibly ANIMATE into the open state — i.e. replay
     * the reveal on every click instead of just staying open. Removed
     * again by a plain mouseleave once the cursor genuinely departs
     * (rebound fresh each render, same as the drag handle listener).
     */
    #restoreHoverState() {
      const win = this.element.querySelector(".countdown-tracker-window");
      if (!win) return;

      const rect = win.getBoundingClientRect();
      const isHovering =
        this._lastMouseX >= rect.left &&
        this._lastMouseX <= rect.right &&
        this._lastMouseY >= rect.top &&
        this._lastMouseY <= rect.bottom;

      if (isHovering) {
        win.classList.add("no-transition", "force-open");
        void win.offsetHeight; // force layout so the untransitioned state is what actually paints
        requestAnimationFrame(() => win.classList.remove("no-transition"));
      }

      win.addEventListener("mouseleave", () => win.classList.remove("force-open"));
    }

    #setupDragging() {
      if (game.settings.get(MODULE_ID, "countdownLocked")) return;

      const dragHandle = this.element.querySelector(".drag-handle");
      if (!dragHandle) return;

      dragHandle.addEventListener("mousedown", this.#onDragStart.bind(this));
    }

    #onDragStart(e) {
      if (e.button !== 0) return;

      this._dragData.isDragging = true;
      this._dragData.startX = e.clientX;
      this._dragData.startY = e.clientY;

      const rect = this.element.getBoundingClientRect();
      this._dragData.startLeft = rect.left;
      this._dragData.startBottom = window.innerHeight - rect.bottom;
      this._dragData.width = rect.width;
      this._dragData.height = rect.height;

      this.element.style.cursor = "grabbing";

      window.addEventListener("mousemove", this._onDraggingBound);
      window.addEventListener("mouseup", this._onDragEndBound);
    }

    #onDragging(e) {
      if (!this._dragData.isDragging) return;

      const dx = e.clientX - this._dragData.startX;
      const dy = e.clientY - this._dragData.startY;

      const maxLeft = Math.max(0, window.innerWidth - this._dragData.width);
      const maxBottom = Math.max(0, window.innerHeight - this._dragData.height);
      const newLeft = Math.max(0, Math.min(this._dragData.startLeft + dx, maxLeft));
      const newBottom = Math.max(0, Math.min(this._dragData.startBottom - dy, maxBottom));

      this.element.style.left = `${newLeft}px`;
      this.element.style.bottom = `${newBottom}px`;
    }

    #onDragEnd() {
      if (!this._dragData.isDragging) return;
      this._dragData.isDragging = false;
      this.element.style.cursor = "";

      window.removeEventListener("mousemove", this._onDraggingBound);
      window.removeEventListener("mouseup", this._onDragEndBound);

      const rect = this.element.getBoundingClientRect();
      const pos = { left: rect.left, bottom: window.innerHeight - rect.bottom };

      game.settings.set(MODULE_ID, "countdownPosition", pos);
    }

    async close(options) {
      window.removeEventListener("mousemove", this._trackMouseBound);
      return super.close(options);
    }
  };

  // Called from main.js's own Hooks.once("ready", ...) block, so "ready"
  // is already firing by the time registerCountdownTracker() runs — a
  // nested Hooks.once("ready", ...) here would never fire (once() only
  // catches a FUTURE emission of the hook, not the one already in
  // progress), so initialize directly instead.
  CountdownTrackerApp.initialize();

  Hooks.on("DhRefresh", (data) => {
    if (data.refreshType === "DhCoundownRefresh") {
      CountdownTrackerApp.instance?.render();
    }
  });

  // Injects a "Create Countdown" button into the Daggerheart system's own
  // GM sidebar menu — system integration point, unrelated to this module's
  // own settings menu.
  Hooks.on("renderDaggerheartMenu", (_app, html) => {
    if (!game.user.isGM) return;

    const fieldset = document.createElement("fieldset");
    fieldset.classList.add("enhanced-ui-countdown-sidebar");
    fieldset.innerHTML = `
      <legend>Countdowns</legend>
      <div class="menu-refresh-container">
        <button type="button" class="create-countdown-btn">
          <i class="fa-solid fa-clock"></i> Create New Countdown
        </button>
      </div>
    `;

    fieldset.querySelector(".create-countdown-btn").addEventListener("click", () => {
      if (game.system.api.applications.ui.CountdownEdit) {
        new game.system.api.applications.ui.CountdownEdit().render(true);
      }
    });

    html.appendChild(fieldset);
  });
}
