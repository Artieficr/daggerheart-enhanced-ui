/**
 * Shared minisheet screen-anchoring logic (`_injectContainer`/collapse/
 * expand), used by all five minisheet files — see CLAUDE.md's "Working
 * rules" for why extracting shared helpers across upstream-derived files is
 * fine in this fork. All five minisheet types anchor bottom-left, with no
 * per-type centering or horizontal offset.
 */

// z-index:90 — above the Countdown Tracker (75, see countdown-tracker.css)
// and Party Overview (60), so anything popping out of the minisheet (the
// Effects & Conditions panel included) renders over those ambient widgets
// instead of under them — but still below Foundry's own --z-index-window
// (100), the tier every genuine Foundry ApplicationV2 window (an item
// sheet, a Dialog, the compendium browser, etc.) renders at or above, so a
// real window opened from the minisheet (right-click an item, say) is never
// left rendering behind it. See CLAUDE.md's z-index tiers note.
export function containerStyleFor() {
  return "position:fixed;bottom:0;left:0;z-index:90;";
}

export function transformOriginFor() {
  return "bottom left";
}

export function scaleTransformFor(scale) {
  return `scale(${scale})`;
}

export function idleTransform() {
  return "";
}

export function collapsedTransform(height) {
  return `translateY(${height + 58}px)`;
}

/** Builds the #enhanced-ui-sheet container + its scaled inner wrapper. */
export function injectMinisheetContainer() {
  const container = document.createElement("div");
  container.id = "enhanced-ui-sheet";
  container.style.cssText = containerStyleFor();

  const scaleWrapper = document.createElement("div");
  scaleWrapper.classList.add("minisheet-transform-wrapper");
  scaleWrapper.style.transformOrigin = transformOriginFor();

  const scale = game.settings.get("daggerheart-enhanced-ui", "minisheetScale");
  scaleWrapper.style.transform = scaleTransformFor(scale);

  container.appendChild(scaleWrapper);
  document.body.appendChild(container);
  return container;
}
