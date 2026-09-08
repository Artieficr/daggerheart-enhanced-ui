import { scaleTransformFor, transformOriginFor } from "./sheets/minisheets/minisheet-position.js";

export function registerSettings() {

  // Theme Foundryborne
  game.settings.register("daggerheart-sleek-ui", "theme", {
    name: "Theme Foundryborne",
    hint: "Enables the styling of Foundryborne's application windows to match Sleek UI's styling",
    requiresReload: true,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Theme Chat Cards
  game.settings.register("daggerheart-sleek-ui", "themeChat", {
    name: "Theme Chat Cards",
    hint: "Enables the styling of chat cards to match Sleek UI's styling",
    requiresReload: true,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Minisheets
  game.settings.register("daggerheart-sleek-ui", "enableMinisheet", {
    name: "Enable Mini Sheets",
    hint: "Enables the mini sheet displayed at the bottom of the screen while a token is selected",
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
  game.settings.register("daggerheart-sleek-ui", "minisheetVisible", {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  // Remembers which owned actor's minisheet to show when visible with no
  // token controlled and the player owns more than one pinnable actor.
  game.settings.register("daggerheart-sleek-ui", "minisheetPinnedActor", {
    scope: "client",
    config: false,
    type: String,
    default: "",
  });

  // Minisheet Style

  //Minisheet Transform
  game.settings.register("daggerheart-sleek-ui", "minisheetScale", {
    name: "Minisheet Scale",
    hint: "Adjusts the scale of the mini sheets to better accomodate smaller or larger screens (default: 1)",
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
  game.settings.register("daggerheart-sleek-ui", "tabsPosition", {
    name: "Tabs Position",
    scope: "client",
    config: true,
    type: String,
    choices: {
      floating: "Floating",
      basic: "Basic",
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
  game.settings.register("daggerheart-sleek-ui", "showTooltip", {
    name: "Show Card Tooltips",
    hint: "Shows tooltips for cards when hovering the icon",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Currency Labels
  game.settings.register("daggerheart-sleek-ui", "currencyLabel", {
    name: "Show Currency Labels",
    hint: "Shows the labels for each currency on top of their values",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  // Beastform Portrait
  game.settings.register("daggerheart-sleek-ui", "beastformPortrait", {
    name: "Use Beastform Portrait",
    hint: "When in beastform, change the character's portrait to the form's Subject Texture",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

}

export function applyMinisheetScale(value) {
  const scale = value ?? game.settings.get("daggerheart-sleek-ui", "minisheetScale");
  const wrapper = document.querySelector("#sleek-ui-sheet .minisheet-transform-wrapper");
  if (wrapper) {
    wrapper.style.transform = scaleTransformFor(scale);
    wrapper.style.transformOrigin = transformOriginFor();
  }
}

export function applyTheme() {
  if (!game.settings.get("daggerheart-sleek-ui", "theme")) return;

  const addStyle = (href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
  };

  addStyle("modules/daggerheart-sleek-ui/styles/theme.css");
}

export function applyThemeChat() {
  if (!game.settings.get("daggerheart-sleek-ui", "themeChat")) return;

  const addStyle = (href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
  };

  addStyle("modules/daggerheart-sleek-ui/styles/theme-chat.css");
}
