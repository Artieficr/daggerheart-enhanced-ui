import { scaleTransformFor, transformOriginFor } from "./sheets/minisheets/minisheet-position.js";

export function registerSettings() {

  // Theme Foundryborne
  game.settings.register("daggerheart-enhanced-ui", "theme", {
    name: "daggerheart-enhanced-ui.settings.theme.name",
    hint: "daggerheart-enhanced-ui.settings.theme.hint",
    requiresReload: true,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Theme Chat Cards
  game.settings.register("daggerheart-enhanced-ui", "themeChat", {
    name: "daggerheart-enhanced-ui.settings.themeChat.name",
    hint: "daggerheart-enhanced-ui.settings.themeChat.hint",
    requiresReload: true,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Minisheets
  game.settings.register("daggerheart-enhanced-ui", "enableMinisheet", {
    name: "daggerheart-enhanced-ui.settings.enableMinisheet.name",
    hint: "daggerheart-enhanced-ui.settings.enableMinisheet.hint",
    requiresReload: true,
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Minisheet visibility — driven by the "Toggle Mini Sheet" token control
  // button (see sheets/minisheets/minisheet-pin.js), not this settings menu.
  // Lets a player hide the minisheet while a token is selected (to free up
  // the hotbar) or show it with no token selected at all (theater of mind).
  game.settings.register("daggerheart-enhanced-ui", "minisheetVisible", {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  // Remembers which owned actor's minisheet to show when visible with no
  // token controlled and the player owns more than one pinnable actor.
  game.settings.register("daggerheart-enhanced-ui", "minisheetPinnedActor", {
    scope: "client",
    config: false,
    type: String,
    default: "",
  });

  // Actor uuids starred in the minisheet's "switch character" picker — only
  // surfaced once a player has more than 5 pinnable actors (mainly a GM
  // convenience, see minisheet-pin.js's buildActorPickerContext).
  game.settings.register("daggerheart-enhanced-ui", "minisheetPinnedFavorites", {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  // Minisheet Style

  //Minisheet Transform
  game.settings.register("daggerheart-enhanced-ui", "minisheetScale", {
    name: "daggerheart-enhanced-ui.settings.minisheetScale.name",
    hint: "daggerheart-enhanced-ui.settings.minisheetScale.hint",
    scope: "client",
    config: true,
    type: Number,
    range: {
      min: 0.8,
      max: 1.2,
      step: 0.05,
    },
    default: 1,
    onChange: (value) => applyMinisheetScale(value),
  });

  // Tabs Position
  game.settings.register("daggerheart-enhanced-ui", "tabsPosition", {
    name: "daggerheart-enhanced-ui.settings.tabsPosition.name",
    scope: "client",
    config: true,
    type: String,
    choices: {
      floating: "daggerheart-enhanced-ui.settings.tabsPosition.choices.floating",
      basic: "daggerheart-enhanced-ui.settings.tabsPosition.choices.basic",
    },
    default: "floating",
    onChange: () => {
      Object.values(ui.windows).forEach((app) => {
        if (app.render) app.render();
      });
    },
  });

  // Quick Access — superseded by card-hand.js's "favoritesDisplayMode"
  // three-way choice (Standard/Quick Access/Card Hand), which replaces this
  // boolean everywhere it was read (character-sheet.js's own context prep
  // included) so the minisheet only ever needs one tab-button, not several.

  // Tooltips
  game.settings.register("daggerheart-enhanced-ui", "showTooltip", {
    name: "daggerheart-enhanced-ui.settings.showTooltip.name",
    hint: "daggerheart-enhanced-ui.settings.showTooltip.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Currency Labels
  game.settings.register("daggerheart-enhanced-ui", "currencyLabel", {
    name: "daggerheart-enhanced-ui.settings.currencyLabel.name",
    hint: "daggerheart-enhanced-ui.settings.currencyLabel.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  // Beastform Portrait
  game.settings.register("daggerheart-enhanced-ui", "beastformPortrait", {
    name: "daggerheart-enhanced-ui.settings.beastformPortrait.name",
    hint: "daggerheart-enhanced-ui.settings.beastformPortrait.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Party Overview widget's own settings live in party-overview.js
  // (registerPartyOverviewSettings), not this file — same "feature owns its
  // own settings" shape as card-hand.js/inventory-panel.js. Moved there so
  // the layout setting's onChange can reach the live widget instance
  // directly, without a cross-file export just for that.

}

export function applyMinisheetScale(value) {
  const scale = value ?? game.settings.get("daggerheart-enhanced-ui", "minisheetScale");
  const wrapper = document.querySelector("#enhanced-ui-sheet .minisheet-transform-wrapper");
  if (wrapper) {
    wrapper.style.transform = scaleTransformFor(scale);
    wrapper.style.transformOrigin = transformOriginFor();
  }
}

export function applyTheme() {
  if (!game.settings.get("daggerheart-enhanced-ui", "theme")) return;

  const addStyle = (href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
  };

  addStyle("modules/daggerheart-enhanced-ui/styles/theme.css");
}

export function applyThemeChat() {
  if (!game.settings.get("daggerheart-enhanced-ui", "themeChat")) return;

  const addStyle = (href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
  };

  addStyle("modules/daggerheart-enhanced-ui/styles/theme-chat.css");
}
