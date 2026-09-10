import { preloadHandlebarsTemplates, registerHelpers } from "./helpers.js";
import { registerSettings, applyMinisheetScale, applyTheme, applyThemeChat } from "./settings.js";
import { registerMinisheetKeybinding } from "./sheets/minisheets/utils-minisheet.js";
import { registerCardHandSettings, registerCardHandSettingsUI, applyCardHandPosition, registerCardHandRuntimeHooks } from "./card-hand.js";
import { registerInventorySettings } from "./inventory-panel.js";
import { registerEffectsSettings } from "./effects-panel.js";
import { registerPartyOverview, registerPartyOverviewSettings, registerPartyOverviewSettingsUI } from "./party-overview.js";
import { registerCountdownTracker, registerCountdownTrackerSettings, registerCountdownTrackerSettingsUI } from "./countdown-tracker.js";

import { registerCharacterSheet } from "./sheets/character-sheet.js";
import { registerCompanionSheet } from "./sheets/companion-sheet.js";
import { registerPartySheet } from "./sheets/party-sheet.js";

import { registerAdversarySheet } from "./sheets/adversary-sheet.js";
import { registerEnvironmentSheet } from "./sheets/environment-sheet.js";

import { registerCharacterMiniSheet } from "./sheets/minisheets/minisheet-character.js";
import { registerCompanionMiniSheet } from "./sheets/minisheets/minisheet-companion.js";
import { registerPartyMiniSheet } from "./sheets/minisheets/minisheet-party.js";
import { registerAdversaryMiniSheet } from "./sheets/minisheets/minisheet-adversary.js";
import { registerEnvironmentMiniSheet } from "./sheets/minisheets/minisheet-environment.js";
import { registerMinisheetPin, syncPinnedMinisheet } from "./sheets/minisheets/minisheet-pin.js";

Hooks.once("init", () => {
  preloadHandlebarsTemplates();
  registerHelpers();
  registerSettings();
  registerCardHandSettings();
  registerCardHandSettingsUI();
  registerInventorySettings();
  registerEffectsSettings();
  registerPartyOverviewSettings();
  registerPartyOverviewSettingsUI();
  registerCountdownTrackerSettings();
  registerCountdownTrackerSettingsUI();
  registerMinisheetKeybinding();
  registerMinisheetPin();
});

Hooks.on("ready", () => {
  applyMinisheetScale();
  applyTheme();
  applyThemeChat();
  applyCardHandPosition();
});

Hooks.once("ready", () => {
  registerCardHandRuntimeHooks();
});

Hooks.once("ready", () => {
  registerCharacterSheet();
  registerCompanionSheet();
  registerPartySheet();

  registerAdversarySheet();
  registerEnvironmentSheet();

  registerCharacterMiniSheet();
  registerCompanionMiniSheet();
  registerPartyMiniSheet();
  registerAdversaryMiniSheet();
  registerEnvironmentMiniSheet();

  // Character/Companion minisheet classes are only just registered above —
  // this is the earliest point an initial pinned-actor display (no token
  // controlled at all, e.g. theater of mind on first load) can be shown.
  syncPinnedMinisheet();

  registerPartyOverview();
  registerCountdownTracker();
});
