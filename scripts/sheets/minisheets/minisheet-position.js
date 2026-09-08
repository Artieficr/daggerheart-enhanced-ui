/**
 * Shared minisheet screen-anchoring logic — extracted from the identical
 * copy-pasted _injectContainer/collapse/expand code that used to live
 * separately in each of the five minisheet files. That duplication was
 * previously left alone on purpose, to keep every future `git merge
 * upstream/main` clean and file-for-file. Decided 2026-09-07: this fork no
 * longer optimizes for that — it's being actively developed as its own
 * thing (Card Hand, this positioning rework, likely more), and upstream's
 * future changes get reviewed and cherry-picked deliberately instead of
 * merged wholesale. See NOTES.md for the full reasoning.
 *
 * All five minisheet types anchor bottom-left now (no centering, no
 * horizontal offset needed) — originally only the character minisheet did
 * this, with the other four kept centered and adjustable via a
 * `minisheetOffset` setting; that distinction (and the setting) was removed
 * once the user decided every minisheet type should behave the same way.
 */

export function containerStyleFor() {
  return "position:fixed;bottom:0;left:0;z-index:70;";
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

/** Builds the #sleek-ui-sheet container + its scaled inner wrapper. */
export function injectMinisheetContainer() {
  const container = document.createElement("div");
  container.id = "sleek-ui-sheet";
  container.style.cssText = containerStyleFor();

  const scaleWrapper = document.createElement("div");
  scaleWrapper.classList.add("minisheet-transform-wrapper");
  scaleWrapper.style.transformOrigin = transformOriginFor();

  const scale = game.settings.get("daggerheart-sleek-ui", "minisheetScale");
  scaleWrapper.style.transform = scaleTransformFor(scale);

  container.appendChild(scaleWrapper);
  document.body.appendChild(container);
  return container;
}
