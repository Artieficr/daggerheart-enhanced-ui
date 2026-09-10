import { formatWeaponDamageDisplay } from "./helpers.js";
import { refreshCharacterMiniSheet } from "./sheets/minisheets/minisheet-character.js";

const MODULE_ID = "daggerheart-enhanced-ui";

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export function registerCardHandSettings() {
  // Replaces enhanced-ui's own boolean "Enable Quick Access" setting. Down to
  // two choices now — "Card Hand" as a separate third option was folded into
  // Standard once Standard grew its own Inventory button, since a player
  // never needs Quick Access, Standard's Inventory, AND Standard's Hand
  // simultaneously as independent top-level choices.
  game.settings.register(MODULE_ID, "favoritesDisplayMode", {
    name: "Minisheet Panel",
    hint: "Quick Access is your own hand-picked shortcut list. Standard shows Inventory (weapons/armor/consumables/items) and Hand (domain cards and class/ancestry/community features) as two separate buttons.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      standard: "Standard (Inventory + Hand)",
      quickAccess: "Quick Access",
    },
    default: "standard",
    // Switches which buttons/windows the minisheet's own template renders
    // (see minisheet.hbs's {{#if (eq favoritesDisplayMode ...)}} branches),
    // not just a CSS toggle — needs a real re-render to take effect
    // immediately instead of only after a reload.
    onChange: () => refreshCharacterMiniSheet(),
  });

  // Only above/right: the minisheet anchors bottom-left by default (see
  // minisheet-position.js), so there's no screen space left of it to open
  // a hand toward.
  game.settings.register(MODULE_ID, "cardHandPosition", {
    name: "Card Hand Position",
    hint: "Where the hand opens relative to the minisheet.",
    scope: "client",
    config: true,
    type: String,
    choices: { right: "Right", above: "Above" },
    default: "right",
    onChange: () => applyCardHandPosition(),
  });

  // Not a user-facing toggle — just remembers whether the hand was left open
  // or closed, so it doesn't need to be reopened after every minisheet
  // remount (deselecting/reselecting a token, reloading the world). Defaults
  // open: "if the user didn't close it, it's always open."
  game.settings.register(MODULE_ID, "cardHandOpen", {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });

  // Client-scoped, not an actor flag: card order is how THIS player likes
  // their own hand arranged, not shared game state — storing it here avoids
  // needing actor-write permission and (more importantly) avoids Foundry's
  // updateActor hook forcing a full minisheet re-render on every drag
  // release, the way setting an actor flag would have. Shape:
  // { [actorId]: { main: [key, ...], children: { [anchorUuid]: [key, ...] } } }
  // — see getStoredOrder/setStoredOrder/getStoredChildOrder/setStoredChildOrder.
  game.settings.register(MODULE_ID, "cardHandOrder", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
}

export function getCardHandOpenState() {
  return game.settings.get(MODULE_ID, "cardHandOpen");
}

export function setCardHandOpenState(value) {
  game.settings.set(MODULE_ID, "cardHandOpen", !!value);
}

/**
 * Reorders `items` (each with a `.uuid` or, for feature-group anchors, an
 * `.uuid` too — anything with a stable `.uuid`) to match a stored key order,
 * falling back to each item's current relative position for anything not in
 * the stored list (new items, or items added since the order was last
 * saved) — those just settle at the end, keeping their own relative order
 * via Array#sort's stability.
 */
function applyStoredOrder(items, storedOrder, keyOf) {
  if (!storedOrder?.length) return items;
  const rank = new Map(storedOrder.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (rank.get(keyOf(a)) ?? Infinity) - (rank.get(keyOf(b)) ?? Infinity));
}

function getStoredOrder(actor) {
  return game.settings.get(MODULE_ID, "cardHandOrder")[actor.id]?.main ?? null;
}

function setStoredOrder(actor, order) {
  const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, "cardHandOrder"));
  all[actor.id] = { ...(all[actor.id] ?? {}), main: order };
  game.settings.set(MODULE_ID, "cardHandOrder", all);
}

function getStoredChildOrder(actor, anchorUuid) {
  return game.settings.get(MODULE_ID, "cardHandOrder")[actor.id]?.children?.[anchorUuid] ?? null;
}

function setStoredChildOrder(actor, anchorUuid, order) {
  const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, "cardHandOrder"));
  const actorEntry = all[actor.id] ?? {};
  actorEntry.children = { ...(actorEntry.children ?? {}), [anchorUuid]: order };
  all[actor.id] = actorEntry;
  game.settings.set(MODULE_ID, "cardHandOrder", all);
}

export function applyCardHandPosition() {
  const position = game.settings.get(MODULE_ID, "cardHandPosition");
  document.querySelectorAll("#enhanced-ui-sheet .card-hand-window-container").forEach((el) => {
    el.classList.remove("pos-above", "pos-right");
    el.classList.add(`pos-${position}`);
  });
}

/**
 * Foundry has no built-in "only show this setting when another setting has
 * a given value" field, but hiding a setting's own .form-group in the
 * rendered Settings dialog (keyed off the other field's live value, not
 * just its saved one) is a well-established pattern other modules use for
 * the same need. Registered against renderSettingsConfig below; also
 * re-run from favoritesDisplayMode's own onChange in case a get()-based
 * cache elsewhere needs nudging.
 */
function applyFavoritesDisplayModeVisibility(rootEl) {
  const root = rootEl ?? document;
  const modeSelect = root.querySelector(`select[name="${MODULE_ID}.favoritesDisplayMode"]`);
  const positionRow = root.querySelector(`select[name="${MODULE_ID}.cardHandPosition"]`)?.closest(".form-group");
  if (!modeSelect || !positionRow) return;

  positionRow.style.display = modeSelect.value === "standard" ? "" : "none";
}

export function registerCardHandSettingsUI() {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    applyFavoritesDisplayModeVisibility(root);

    const modeSelect = root.querySelector(`select[name="${MODULE_ID}.favoritesDisplayMode"]`);
    modeSelect?.addEventListener("change", () => applyFavoritesDisplayModeVisibility(root));
  });
}

// ─── CARD HAND'S OWN HELPERS ─────────────────────────────────────────────────
// Ported directly from their HandManager / default-template.js
// (scripts/hand-manager.js, templates/default/default-template.js in their
// source), not reimplemented. Kept synchronous/no TextEditor.enrichHTML on
// purpose (that was the source of the lag: the previous version enriched
// every item's description on every render, twice, via the full enhanced-ui
// sheet context).

const ASSET_ROOT = "modules/daggerheart-enhanced-ui/assets/cardhand/imgs";
const DIVIDER_SRC = "modules/daggerheart-enhanced-ui/assets/cardhand/improved/domain-divider.png";

// Ported from Card Hand's Improved template (their actual per-domain colors
// for the title-divider hexagon), not the Default template's per-domain
// image assets — this is the template whose layout/text-fit matches what
// the user is actually comparing against.
const DOMAIN_COLORS = {
  blade: "#af231c",
  bone: "#a4a9a8",
  codex: "#24395d",
  grace: "#8d3965",
  midnight: "#1e201f",
  sage: "#244e30",
  splendor: "#f2d72f",
  valor: "#e2680e",
  arcana: "#4e345b",
  default: "#3d3d3d",
};

const DOMAIN_TEXT_COLORS = {
  blade: "#fff",
  bone: "#000",
  codex: "#fff",
  grace: "#fff",
  midnight: "#fff",
  sage: "#fff",
  splendor: "#000",
  valor: "#fff",
  arcana: "#fff",
  default: "#fff",
};

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  if (foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(str));
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDescription(desc) {
  let html = desc || "";
  html = html.replace(/@Template\[[^\]]*\]/g, "");
  html = html.replace(/@[^[]*\[[^\]]*\]\{([^}]*)\}/g, (_m, label) => `<strong>${escapeHtml(label)}</strong>`);
  return html;
}

function formatRange(range) {
  if (!range && range !== 0) return "";
  const i18n = game?.i18n;
  const rangeLabel = i18n?.has("DAGGERHEART.GENERAL.range") ? i18n.localize("DAGGERHEART.GENERAL.range") : "Range";

  let type = "";
  let value = "";

  if (typeof range === "object") {
    type = range.type || range.rangeType || range.mode || "";
    value = range.value ?? range.distance ?? range.range ?? "";
  } else if (typeof range === "string") {
    if (/^[a-zA-Z_]+$/.test(range)) type = range;
    else value = range;
  } else {
    value = String(range);
  }

  let translatedType = "";
  if (type) {
    const key = `DAGGERHEART.CONFIG.Range.${type}.short`;
    translatedType = i18n?.has(key) ? i18n.localize(key) : type;
  }

  const parts = [];
  if (translatedType) parts.push(translatedType);
  if (value !== null && value !== undefined && String(value) !== "") parts.push(String(value));

  if (parts.length === 0) return "";
  return `${rangeLabel}: ${parts.join(" ")}`;
}

function formatItemType(itemType) {
  if (!itemType && itemType !== 0) return "";
  const key = `TYPES.Item.${itemType}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : itemType;
}

function formatDomainCardType(domainCardType) {
  if (!domainCardType && domainCardType !== 0) return "";
  const key = `DAGGERHEART.CONFIG.DomainCardTypes.${domainCardType}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : domainCardType;
}

function itemHasActions(item) {
  const actions = item?.system?.actions;
  if (!actions) return false;
  if (typeof actions.size === "number") return actions.size > 0;
  if (typeof actions === "object") return Object.keys(actions).length > 0;
  return false;
}

// ─── DATA PREP ────────────────────────────────────────────────────────────────
// Reads actor.items directly, no dependency on enhanced-ui's own (expensive)
// full sheet context. Cheap enough to call on every render.

/**
 * Returns an ordered array of card entries: `{ kind: "item", item }` for
 * domain cards and ungrouped features, and `{ kind: "featureGroup",
 * anchorItem, members }` for ancestry/community/class/subclass/multiclass/
 * transformation features grouped one card per source item. Weapons and
 * consumables (and the unarmed attack, alongside them — it lives in
 * Inventory now too) are deliberately NOT included here — those aren't real
 * Daggerheart cards, so they live in the separate Inventory panel
 * (inventory-panel.js) instead. No filter toggles either: everything this
 * function returns is a real card, so there's nothing to hide.
 */
export function buildHandCards(actor) {
  if (!actor) return [];

  const items = actor.items ? Array.from(actor.items) : [];

  // Ancestry/community/class/subclass features get pulled out of the plain
  // item list and re-grouped one card per source item (see
  // buildFeatureGroups) instead of one card per feature — matches how the
  // physical Daggerheart cards actually work.
  const featureGroups = buildFeatureGroups(actor);
  const groupedFeatureIds = new Set(featureGroups.flatMap((g) => g.members.map((m) => m.id)));

  const cards = items
    .filter((item) => {
      if (item.type !== "domainCard" && item.type !== "feature") return false;
      if (item.type === "feature" && groupedFeatureIds.has(item.id)) return false;
      // Mirrors the daggerheart system's own _prepareFeaturesContext
      // looseFeatures computation (confirmed by reading its bundled
      // source): a feature not yet unlocked by level/subclass-tier
      // (isItemAvailable) shouldn't surface at all, grouped or not —
      // buildFeatureGroups already applies this to group members, but
      // anything that check excludes still needs excluding here too,
      // otherwise it falls through as a loose card instead of vanishing.
      if (item.type === "feature" && typeof actor.system.isItemAvailable === "function" && !actor.system.isItemAvailable(item)) return false;
      if (item.type === "feature" && !itemHasActions(item)) return false;
      if (item.type === "domainCard" && item.system.inVault) return false;
      return true;
    })
    .map((item) => ({ kind: "item", item }));

  cards.push(...featureGroups.map((group) => ({ kind: "featureGroup", ...group })));

  cards.sort((a, b) => cardSortScore(a) - cardSortScore(b) || cardSortLabel(a).localeCompare(cardSortLabel(b)));

  // A manual reorder (see renderCardHandReorderPopover) overrides this
  // default sort — anything the player hasn't touched yet just falls back
  // to it, appended after whatever they've already arranged.
  return applyStoredOrder(cards, getStoredOrder(actor), cardHandKey);
}

function cardSortScore(card) {
  if (card.kind === "item") return card.item.type === "domainCard" ? 1 : 2;
  return 2; // featureGroup
}

function cardSortLabel(card) {
  if (card.kind === "item") return card.item.name;
  return card.anchorItem.name;
}

/**
 * Groups ancestry/community/class/subclass/multiclass/transformation
 * features one card per *source* item instead of one per feature. Mirrors
 * exactly how the daggerheart system's own CharacterSheet#_prepareFeaturesContext
 * finds this linkage (confirmed by reading the system's bundled source): each
 * anchor item exposes its granted features via its own
 * `system.getLinkedItems()` — no need to go through the expensive full sheet
 * context just to get this grouping.
 *
 * A group always gets built — and always shown as a stack, even with a
 * single member (see buildHandCardElement/useHandCard) — rather than only
 * grouping when there's more than one linked feature. An ancestry card
 * itself was never meant to be "played" directly; its features are, and
 * silently proxying straight to the sole feature when there's only one
 * defeats the point of keeping the parent/feature relationship visible.
 * `itemHasActions` isn't applied here either: even a purely narrative
 * feature (no roll/cost) is still real card content worth seeing, matching
 * how the physical cards list every granted feature regardless.
 */
function buildFeatureGroups(actor) {
  const sys = actor.system;
  const anchorItems = [
    ...(actor.itemTypes?.transformation ?? []),
    sys.ancestry,
    sys.community,
    sys.class?.value,
    sys.class?.subclass,
    sys.multiclass?.value,
    sys.multiclass?.subclass,
  ].filter(Boolean);

  const groups = [];
  for (const anchor of anchorItems) {
    if (typeof anchor.system?.getLinkedItems !== "function") continue;
    let members = anchor.system
      .getLinkedItems()
      .filter((i) => i.type === "feature" && (typeof sys.isItemAvailable !== "function" || sys.isItemAvailable(i)));
    if (!members.length) continue;
    members = applyStoredOrder(members, getStoredChildOrder(actor, anchor.uuid), (m) => m.uuid);
    groups.push({ anchorItem: anchor, members });
  }
  return groups;
}

// ─── CARD FACE RENDERING ─────────────────────────────────────────────────────
// Ported directly from Card Hand's own ImprovedTemplate
// (templates/improved/improved-template.js in their source — the template
// whose bottom-anchored, grow-upward text block actually fits long
// descriptions, unlike the Default template's fixed 51/49 split). Uses their
// actual banner/stress-cost art (same files Default uses) plus the shared
// domain-divider.png, all copied into assets/cardhand/.

/**
 * Direct port of Card Hand's ImprovedTemplate.renderCard(item). Adapted
 * only to source the weapon damage string from enhanced-ui's own
 * formatWeaponDamageDisplay (handles both the current damage.main schema
 * and the legacy damage.parts one Card Hand's own _getDamageFormula only
 * supports — using theirs verbatim risked silently showing no damage on
 * this world's system version) — everything else (domain colors, layout,
 * font-size formula) is theirs as written.
 */
function renderCardFace(item, actor) {
  const img = item.img || "icons/svg/item-bag.svg";
  const desc = item.system.description?.value || item.system.description || "";

  const tempDiv = document.createElement("div");
  const processed = formatDescription(desc);
  tempDiv.innerHTML = processed;
  const plainDesc = tempDiv.innerHTML || tempDiv.innerText || "";

  const minFontSize = 12;
  const maxFontSize = 14;
  let fontSize = maxFontSize;

  const textLength = plainDesc.length;
  if (textLength <= 360) {
    fontSize = maxFontSize;
  } else if (textLength >= 940) {
    fontSize = minFontSize;
  } else {
    const t = (textLength - 360) / (940 - 360);
    fontSize = Math.round(maxFontSize + (minFontSize - maxFontSize) * t);
  }
  fontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));

  let domainKey = "default";
  let domainCardType = "default";
  if (item.system.domain) {
    domainKey = item.system.domain.toLowerCase();
    domainCardType = item.system.type || "ability";
  } else if (item.type === "class") {
    domainKey = item.name.toLowerCase();
  }

  const domainColor = DOMAIN_COLORS[domainKey] || DOMAIN_COLORS.default;
  const domainFontColor = DOMAIN_TEXT_COLORS[domainKey] || DOMAIN_TEXT_COLORS.default;

  const bannerSrc = `${ASSET_ROOT}/${domainKey}/banner.avif`;
  const stressSrc = `${ASSET_ROOT}/default/stress-cost.avif`;

  const level = item.system.level || "";
  const recallCost = item.system.recallCost;
  const stressCost = item.system.stress;

  let costValue = "";
  if (recallCost !== null && recallCost !== undefined && recallCost !== 0) {
    costValue = recallCost;
  } else if (stressCost !== null && stressCost !== undefined && stressCost !== 0) {
    costValue = stressCost;
  }
  const showStress = costValue !== "";

  let damageHtml = "";
  const itemType = item.type || item.system.type || "ability";
  let itemTypeLocalized = formatItemType(itemType);

  if (itemType === "weapon") {
    const damageFormula = formatWeaponDamageDisplay(item.system.attack, { rollData: actor.getRollData() });
    const rangeText = formatRange(item.system?.attack?.range || item.system?.range || "");
    if (damageFormula) {
      damageHtml = `
        <div class="damage-info">
            <span class="damage-formula">${damageFormula}</span>
            ${rangeText ? `<span class="damage-range">${escapeHtml(rangeText)}</span>` : ""}
        </div>
      `;
    }
  }

  if (item.system.domain) {
    itemTypeLocalized = formatDomainCardType(domainCardType);
  }

  return `
    ${level ? `<img class="card-banner_image" src="${bannerSrc}"><div class="card-level" style="color: ${domainFontColor};">${escapeHtml(level)}</div>` : ""}
    ${showStress ? `<img class="stress_image" src="${stressSrc}"><div class="stress_text">${escapeHtml(costValue)}</div>` : ""}
    <div class="card-image-container">
      <img class="card-main-image" src="${escapeHtml(img)}" draggable="false">
    </div>
    <div class="card-text-content">
      <div class="divider-container">
        <div class="title-bg">
          <div class="title-bg-inner" style="background-color: ${domainColor};"></div>
          <img class="title-bg-divider" src="${DIVIDER_SRC}" draggable="false" alt="">
        </div>
        <p class="card-type" style="color: ${domainFontColor};">${escapeHtml(itemTypeLocalized)}</p>
      </div>
      <div class="card-title">${escapeHtml(item.name)}</div>
      ${damageHtml}
      <div class="description" style="font-size: ${fontSize}px;">${plainDesc}</div>
    </div>
  `;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
// Reconciles the DOM against the latest buildHandCards() result instead of
// wiping and rebuilding every card on every call, so a filter toggle (or any
// other actor-item change) animates cards in/out and lets the fan reflow
// smoothly instead of jump-cutting. See reconcileCardHandList.

function cardHandKey(card) {
  if (card.kind === "featureGroup") return `group:${card.anchorItem.uuid}`;
  return card.item.uuid;
}

function renderCardFaceFor(card, actor) {
  if (card.kind === "featureGroup") return renderCardFace(card.anchorItem, actor);
  return renderCardFace(card.item, actor);
}

function buildHandCardElement(card, actor) {
  const el = document.createElement("div");
  el.className = "hand-card";
  el.dataset.handKey = cardHandKey(card);
  el.dataset.cardKind = card.kind;

  if (card.kind === "featureGroup") {
    el.dataset.itemUuid = card.anchorItem.uuid;
    el.dataset.memberUuids = card.members.map((m) => m.uuid).join(",");
  } else {
    el.dataset.itemUuid = card.item.uuid;
  }

  // The hitzone is the only part of the card that actually receives pointer
  // events — .dhc-scaler (the art/text preview) is pointer-events:none, so
  // hovering/dragging is always driven by this fixed-size slice underneath
  // it instead of by whatever the enlarged preview currently overlaps. See
  // the "focused card" note on .hand-card-hitzone in card-hand.css for why:
  // without it, a hovered card's ballooning preview (and its z-index boost)
  // could keep "winning" hover over a neighboring card's own slot for as
  // long as the cursor stayed anywhere near it. applyCardHandFanLayout sets
  // this element's width per card once it knows the fan's actual overlap.
  const hitzoneHtml = `<div class="hand-card-hitzone"></div>`;
  const scalerHtml = `<div class="dhc-scaler" data-item-uuid="${el.dataset.itemUuid}">${renderCardFaceFor(card, actor)}</div>`;

  el.innerHTML = `${hitzoneHtml}${scalerHtml}`;

  // Every group — even a single-feature one — gets a real hover-revealed
  // sub-stack of its actual member cards, each fully interactive on its own
  // (a feature can be played directly from the stack without going through
  // the parent at all). Always stacking, not just for 2+ members, is
  // deliberate: an ancestry/class card was never meant to be "played"
  // directly, so a lone feature still needs its own card in the way, rather
  // than the parent silently proxying straight to it.
  if (card.kind === "featureGroup") {
    const substack = document.createElement("div");
    // .card-hand-list too: at rest, plain CSS (absolute positioning + nth-
    // child, see card-hand.css) stacks the members behind the parent, each
    // one a small step above the last, no JS involved. On hover this class
    // is what lets applyCardHandFanLayout — the exact same function that
    // lays out the main hand — treat this container as a fan of its own,
    // instead of writing a second fan-layout implementation.
    substack.className = "hand-card-substack card-hand-list";
    card.members.forEach((member) => {
      substack.appendChild(buildHandCardElement({ kind: "item", item: member }, actor));
    });
    el.appendChild(substack);

    // Invisible bridge spanning the gap between the parent card and the
    // revealed fan above it — see the CSS for why this is needed (without
    // it, moving the cursor from the parent toward a child crossed empty
    // space outside this card's own subtree, which collapsed the fan
    // mid-transit before you could ever reach a card to drag it).
    const bridge = document.createElement("div");
    bridge.className = "hand-card-hover-bridge";
    el.appendChild(bridge);

    // Real pointer events, not CSS :hover, drive turning the stack into a
    // fan: computing per-card rotation/overlap needs applyCardHandFanLayout
    // to actually run, and CSS alone can't call a function. pointerenter/
    // pointerleave (unlike mouseenter/mouseleave-via-bubbling on a
    // descendant) only fire when entering/leaving this element's own
    // subtree as a whole, which is exactly "the parent, its hover bridge, or
    // any of its revealed feature cards" — moving between them doesn't
    // re-trigger or cancel it. The bridge starts pointer-events:none (see
    // its CSS) precisely so it can't be what TRIGGERS this in the first
    // place — only the parent's own hitzone or an already-peeking member
    // card can do that. Enabling the bridge here, once focus is real, is
    // what then lets it do its actual job of keeping that focus alive on
    // the way up to a child card.
    el.addEventListener("pointerenter", () => {
      bridge.style.pointerEvents = "auto";
      applyCardHandFanLayout(el);
    });
    el.addEventListener("pointerleave", () => {
      bridge.style.pointerEvents = "";
      // Don't reset while a member card is actively being dragged
      // (.forced-open, set/cleared by attachGrabGesture) — clearing the
      // OTHER cards' fan-assigned inline styles mid-drag just because the
      // cursor drifted off the group's own hover area would visually
      // collapse them out of formation for no reason; onEnd cleans up (both
      // the drag itself and this class) once the drag actually finishes.
      if (substack.classList.contains("forced-open")) return;
      resetSubstackLayout(substack);
    });
  }

  attachCardHandCardInteractions(el, actor);
  return el;
}

/** Clears the inline styles applyCardHandFanLayout sets, so the sub-stack's plain CSS rest layout (vertical peek behind the parent) takes back over. */
function resetSubstackLayout(substack) {
  [...substack.children].forEach((card) => {
    card.style.marginLeft = "";
    card.style.zIndex = "";
    card.style.transformOrigin = "";
    card.style.transform = "";
    const hitzone = card.querySelector(":scope > .hand-card-hitzone");
    if (hitzone) hitzone.style.width = "";
  });
}

function removeHandCardElement(el) {
  el.classList.add("hand-card-removing");
  const cleanup = () => el.remove();
  el.addEventListener("transitionend", cleanup, { once: true });
  // Fallback in case a transition doesn't fire (e.g. reduced-motion, or the
  // element was already mid-removal) — never leave a dead card in the DOM.
  setTimeout(cleanup, 400);
}

/** Diffs the new card list against the current DOM instead of replacing it wholesale. */
function reconcileCardHandList(list, cards, actor) {
  const existing = new Map([...list.children].map((el) => [el.dataset.handKey, el]));
  const keep = new Set(cards.map(cardHandKey));

  for (const [key, el] of existing) {
    if (!keep.has(key)) removeHandCardElement(el);
  }

  for (const card of cards) {
    const key = cardHandKey(card);
    const current = existing.get(key);
    // appendChild on an already-attached node just reorders it, so surviving
    // cards keep their element (and never re-play their entrance) while
    // still landing in the right sort position.
    const el = current && !current.classList.contains("hand-card-removing") ? current : buildHandCardElement(card, actor);
    list.appendChild(el);
  }
}

export function renderCardHandWindow(minisheetElement, actor) {
  if (!minisheetElement || !actor) return;
  if (game.settings.get(MODULE_ID, "favoritesDisplayMode") !== "standard") return;

  const handWindow = minisheetElement.querySelector(".card-hand-window");
  if (!handWindow) return;

  const cards = buildHandCards(actor);

  if (!cards.length) {
    handWindow.innerHTML = `<div class="no-cards">No usable cards</div>`;
    return;
  }

  let list = handWindow.querySelector(".card-hand-list");
  if (!list) {
    handWindow.innerHTML = `<div class="card-hand-list"></div>`;
    list = handWindow.querySelector(".card-hand-list");
  }

  reconcileCardHandList(list, cards, actor);
  applyCardHandPosition();
  // Force a layout flush between the DOM reconciliation above and the fan
  // restyle below. Without this, surviving cards' margin-left/transform
  // changes land in the same synchronous batch as the DOM mutations that
  // caused them, so the browser has no committed "before" frame to
  // transition from — they jump straight to the new fan position instead of
  // sliding into it. void list.offsetHeight forces that checkpoint.
  void list.offsetHeight;
  applyCardHandFanLayout(handWindow);
}

// ─── REORDER POPOVER ─────────────────────────────────────────────────────────
// A plain, title-only sortable list next to the Hand button, replacing an
// earlier attempt at reordering by dragging the actual fanned cards around
// live. That felt clunky in practice (rotated, overlapping cards fighting a
// drag-up-to-use gesture at the same time) — a simple list of rows is a much
// more standard, much more reliable reorder UI, and doesn't need to touch the
// fan's own drag gesture at all. Feature groups nest a second, per-group list
// one level in (click the group's own row to open it) — reusing the exact
// same list-building and drag-and-drop code, just pointed at a different set
// of rows and a different persistence target (setStoredOrder vs
// setStoredChildOrder).

/**
 * Native HTML5 drag-and-drop, not the custom mouse-gesture system the fan
 * itself uses — these are plain rows, not rotated/overlapping cards fighting
 * a second gesture (drag-up-to-use) at the same time, so there's no need for
 * anything more involved than the browser's own reorder handling.
 */
function attachReorderRowDnD(list, onReorder) {
  let draggedRow = null;

  list.querySelectorAll(".hand-reorder-row").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      draggedRow = row;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.handKey ?? "");
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      draggedRow = null;
      onReorder([...list.querySelectorAll(".hand-reorder-row")].map((r) => r.dataset.handKey));
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!draggedRow || draggedRow === row) return;
      const rect = row.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      list.insertBefore(draggedRow, before ? row : row.nextSibling);
    });
  });
}

/**
 * The top-level list: every current hand card, in its current order, one row
 * each. A feature group's row gets a chevron that opens a SECOND popover
 * beside this one (see renderReorderChildList) for just that group's own
 * members — a side panel, not a navigation swap, so the top-level order
 * stays visible/reorderable at the same time.
 */
function renderReorderMainList(popoverEl, minisheetElement, actor) {
  const cards = buildHandCards(actor);

  const rows = cards
    .map((card) => {
      const key = cardHandKey(card);
      const title = cardSortLabel(card);
      const childBtn =
        card.kind === "featureGroup"
          ? `<button type="button" class="hand-reorder-children-btn" data-anchor-uuid="${escapeHtml(card.anchorItem.uuid)}"><i class="fa-solid fa-chevron-right"></i></button>`
          : "";
      return `
        <div class="hand-reorder-row" draggable="true" data-hand-key="${escapeHtml(key)}">
          <i class="fa-solid fa-grip-lines"></i>
          <span class="hand-reorder-title">${escapeHtml(title)}</span>
          ${childBtn}
        </div>`;
    })
    .join("");

  popoverEl.innerHTML = `
    <div class="hand-reorder-header">Reorder Hand</div>
    <div class="hand-reorder-list">${rows || `<div class="no-cards">No cards</div>`}</div>
    <div class="hand-reorder-child-popover"></div>
  `;

  attachReorderRowDnD(popoverEl.querySelector(".hand-reorder-list"), (keys) => {
    setStoredOrder(actor, keys);
    renderCardHandWindow(minisheetElement, actor);
  });

  const childPopover = popoverEl.querySelector(".hand-reorder-child-popover");
  popoverEl.querySelectorAll(".hand-reorder-children-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // A <button> keeps the browser's default focus ring after being
      // clicked, not just while actively focused via keyboard — without
      // this it stayed visibly "lit" on whichever chevron was last clicked
      // even after its panel had closed, regardless of which group's panel
      // was actually open. Blurred so the ring itself never shows; the
      // .active class below (toggled explicitly, not left to the browser)
      // is what marks the chevron for whichever group is genuinely open.
      btn.blur();
      const anchorUuid = btn.dataset.anchorUuid;
      popoverEl.querySelectorAll(".hand-reorder-children-btn").forEach((b) => b.classList.remove("active"));
      // Clicking the already-open group's own chevron again closes it,
      // rather than just re-rendering the same thing.
      if (childPopover.classList.contains("active") && childPopover.dataset.anchorUuid === anchorUuid) {
        childPopover.classList.remove("active");
        return;
      }
      btn.classList.add("active");
      childPopover.dataset.anchorUuid = anchorUuid;
      renderReorderChildList(childPopover, minisheetElement, actor, anchorUuid);
      childPopover.classList.add("active");
    });
  });
}

/** One feature group's own member list — a side panel next to the main list, see renderReorderMainList. */
function renderReorderChildList(childPopoverEl, minisheetElement, actor, anchorUuid) {
  const group = buildFeatureGroups(actor).find((g) => g.anchorItem.uuid === anchorUuid);
  if (!group) {
    childPopoverEl.classList.remove("active");
    return;
  }

  const rows = group.members
    .map(
      (member) => `
        <div class="hand-reorder-row" draggable="true" data-hand-key="${escapeHtml(member.uuid)}">
          <i class="fa-solid fa-grip-lines"></i>
          <span class="hand-reorder-title">${escapeHtml(member.name)}</span>
        </div>`,
    )
    .join("");

  childPopoverEl.innerHTML = `
    <div class="hand-reorder-header">${escapeHtml(group.anchorItem.name)}</div>
    <div class="hand-reorder-list">${rows}</div>
  `;

  attachReorderRowDnD(childPopoverEl.querySelector(".hand-reorder-list"), (keys) => {
    setStoredChildOrder(actor, anchorUuid, keys);
    renderCardHandWindow(minisheetElement, actor);
  });
}

/** Entry point — builds the top-level list; a group's chevron opens its own side panel from there. */
export function renderCardHandReorderPopover(popoverEl, minisheetElement, actor) {
  if (!popoverEl) return;
  renderReorderMainList(popoverEl, minisheetElement, actor);
}

/**
 * How much horizontal room the fan gets before compression kicks in.
 * Deliberately not measured off the minisheet's actual getBoundingClientRect
 * — that produced far more aggressive compression than the visible free
 * space justified (likely some transform/positioning interaction that's
 * hard to pin down without live devtools access). A plain fraction of the
 * viewport is simpler, predictable, and easy to verify by inspection:
 * "above" is centered so it can use nearly the full width; "right" only
 * ever gets one side of the screen, so roughly half is a safe assumption
 * regardless of exactly where the minisheet sits.
 */
function getAvailableFanWidth() {
  const position = game.settings.get(MODULE_ID, "cardHandPosition");
  const viewportWidth = window.innerWidth;
  if (position === "above") return viewportWidth - 48;
  return viewportWidth * 0.48;
}

/**
 * Arches the hand into an overlapping fan: each card rotates by its distance
 * from center and lifts slightly, overlapping its neighbor via negative
 * margin — mirrors Card Hand's own applyCardFanLayout, including its
 * dynamic-compression math (tighten the overlap once the fan's natural
 * width would exceed the space actually available).
 */
export function applyCardHandFanLayout(rootEl) {
  // Accepts either a wrapper containing a .card-hand-list descendant (the
  // usual call shape) or the list itself directly — the live drag-reorder
  // logic in attachGrabGesture already has the list in hand and shouldn't
  // need to fake up a wrapper just to satisfy a querySelector.
  const list = rootEl.classList?.contains("card-hand-list") ? rootEl : rootEl.querySelector(".card-hand-list");
  if (!list) return;

  // Cards mid-removal (see removeHandCardElement) are excluded from the fan
  // math entirely — they stay in the DOM just long enough to fade out in
  // place while their still-present siblings reflow to fill the gap.
  const cards = [...list.children].filter((el) => el.classList.contains("hand-card") && !el.classList.contains("hand-card-removing"));
  const count = cards.length;
  if (!count) return;

  const maxAngle = 10;
  const cardWidth = 160;
  const baseOverlap = -70;
  const minOverlap = -140;

  let overlap = baseOverlap;
  if (count > 1) {
    const availableWidth = getAvailableFanWidth();
    const naturalWidth = cardWidth + (count - 1) * (cardWidth + baseOverlap);
    if (naturalWidth > availableWidth) {
      const spacePerCard = (availableWidth - cardWidth) / (count - 1);
      overlap = Math.max(minOverlap, Math.min(baseOverlap, spacePerCard - cardWidth));
    }
  }

  const centerIndex = (count - 1) / 2;
  const angleStep = count > 1 ? maxAngle / (count / 2) : 0;

  cards.forEach((card, index) => {
    card.style.marginLeft = index > 0 ? `${overlap}px` : "0px";
    card.style.zIndex = String(index + 1);
    card.style.transformOrigin = "bottom center";

    const distFromCenter = index - centerIndex;
    const rotation = angleStep ? distFromCenter * angleStep : 0;
    const yOffset = Math.abs(distFromCenter) * 6;
    card.style.transform = `rotate(${rotation}deg) translateY(${yOffset}px)`;

    // Every card except the last one gets its right edge covered by the
    // next card (which sits on top of it, per the z-index above) — so its
    // hitzone (the only part of it that's actually hoverable/clickable, see
    // the CSS note on .hand-card-hitzone) is narrowed to just the slice that
    // isn't covered. The last card has nothing covering it, so it keeps the
    // full card width. The extra -20 buffer (on top of the margin overlap
    // itself) is a heuristic, not exact geometry: rotation means the true
    // uncovered sliver isn't a clean vertical-edged rectangle the way the
    // unrotated margin math implies, and the plain `cardWidth + overlap`
    // width still felt too generous in practice — you had to travel further
    // right than expected before the next card actually took hover. A 24px
    // floor keeps it clickable even at max overlap compression.
    const hitzone = card.querySelector(":scope > .hand-card-hitzone");
    if (hitzone) {
      const isLast = index === count - 1;
      hitzone.style.width = isLast ? `${cardWidth}px` : `${Math.max(cardWidth + overlap - 20, 24)}px`;
    }
  });
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
// Hover-to-focus is pure CSS (see card-hand.css); this wires the other two
// Card Hand behaviors: drag-up-to-use, and right-click-to-open-sheet. There
// is deliberately no click-to-use — Card Hand's own cards only trigger on the
// drag-up gesture, exactly mirrored here.

/**
 * Right-click opens a sheet: for a feature group this is the anchor item's
 * own sheet (e.g. the Elf ancestry item), since data-item-uuid points at the
 * anchor for that kind — there's no single feature sheet that would make
 * sense to show instead.
 */
function attachCardHandCardInteractions(card, actor) {
  attachGrabGesture(card, actor);

  card.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const uuid = card.dataset.itemUuid;
    const item = uuid ? await fromUuid(uuid) : null;
    if (item?.sheet?.render) item.sheet.render(true);
  });
}

/**
 * Resolves what "using" a card actually means per kind: a plain item calls
 * its own use()/roll()/toChat(); a feature group with exactly one actionable
 * member uses it outright, and a group with several opens the center-screen
 * reveal instead of a dialog picker (see showFeatureGroupOverlay) — the same
 * members are also directly reachable without dragging the parent at all,
 * via the hover-revealed sub-stack built in buildHandCardElement.
 */
async function useHandCard(card, actor) {
  const kind = card.dataset.cardKind;

  if (kind === "featureGroup") {
    // Always reveal the stack, even for a single feature — an ancestry/class
    // card was never meant to be "played" directly, so the parent never
    // proxies straight to its sole feature.
    const uuids = (card.dataset.memberUuids || "").split(",").filter(Boolean);
    const members = (await Promise.all(uuids.map((uuid) => fromUuid(uuid)))).filter(Boolean);
    if (members.length) showFeatureGroupOverlay(members, actor, card.closest("#enhanced-ui-sheet"));
  } else {
    const uuid = card.dataset.itemUuid;
    const item = uuid ? await fromUuid(uuid) : null;
    if (!item) return;
    if (typeof item.use === "function") await item.use({});
    else if (typeof item.roll === "function") await item.roll({});
    else if (typeof item.toChat === "function") await item.toChat(item.uuid);
  }

  card.dispatchEvent(new CustomEvent("handcard:used", { bubbles: true }));
}

/**
 * The "drop the parent, its features fade in from the center" reveal: builds
 * a small overlay fan of the group's actual member cards (full-size, fully
 * interactive — reuses buildHandCardElement the same way the hover sub-stack
 * does) centered on screen. Dismissed by using any card in it (the
 * "handcard:used" bubble from useHandCard above), clicking the dimmed
 * backdrop, or Escape.
 */
function showFeatureGroupOverlay(members, actor, host) {
  if (!host) return;
  host.querySelector(":scope > .card-hand-group-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "card-hand-group-overlay";

  const fan = document.createElement("div");
  fan.className = "card-hand-group-overlay-fan card-hand-list";
  overlay.appendChild(fan);

  members.forEach((member) => {
    fan.appendChild(buildHandCardElement({ kind: "item", item: member }, actor));
  });

  host.appendChild(overlay);
  applyCardHandFanLayout(overlay);

  // Fade out before removing — just calling .remove() skipped the .active
  // CSS transition entirely (there's no frame left to animate once the node
  // is gone), whether the overlay was cancelled or a card in it got played.
  const close = () => {
    overlay.classList.remove("active");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(() => overlay.remove(), 250);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener("handcard:used", close, { once: true });
  document.addEventListener("keydown", onKeydown);

  requestAnimationFrame(() => overlay.classList.add("active"));
}

/**
 * A member card's only rotated ancestor is its own feature group's card in
 * the main fan (a card in the main fan itself, or one in the center-screen
 * overlay, has no rotated ancestor at all — this returns 0 for both). Reads
 * the angle straight out of that ancestor's own inline transform, which
 * applyCardHandFanLayout always writes as `rotate(Xdeg) ...` — parsing our
 * own known format here rather than fighting a computed-style matrix.
 */
function getAncestorRotationDeg(card) {
  const groupCard = card.closest(".hand-card-substack")?.parentElement;
  if (!groupCard) return 0;
  const match = /rotate\(([-\d.]+)deg\)/.exec(groupCard.style.transform || "");
  return match ? -parseFloat(match[1]) : 0;
}

/**
 * Custom mouse/touch drag simulation (not native HTML5 DnD — Card Hand's own
 * CardSmoothDnD does the same, avoiding native drag's image-hijacking and
 * giving a "physical card" feel). Dragging the card up more than 100px uses
 * it; anything less snaps it back into the fan.
 */
function attachGrabGesture(card, actor) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseTransform = "";
  let counterRotateDeg = 0;

  const onMove = (event) => {
    if (!dragging) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    card.style.transition = "none";
    card.style.zIndex = "9999";
    // rotate(0deg) alone only zeroes this card's OWN rotation — for a member
    // card nested inside a feature group's sub-stack, that group card is
    // itself rotated by whatever the MAIN fan gave it, and a nested
    // element's rendered orientation is its own transform on top of its
    // rotated ancestor's, not instead of it. counterRotateDeg (the negative
    // of that ancestor's current rotation, captured once in onStart) is what
    // actually cancels it out — without this the card looked crooked while
    // held, straightening only once released.
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${counterRotateDeg}deg) scale(1.1)`;
    if (event.touches) event.preventDefault();
  };

  const onEnd = async (event) => {
    if (!dragging) return;
    dragging = false;

    const point = event.changedTouches ? event.changedTouches[0] : event;
    const totalDx = point.clientX - startX;
    const totalDy = point.clientY - startY;

    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.body.classList.remove("dragging-active");

    card.style.transition = "";
    card.style.transform = baseTransform;

    // A member card's group card might genuinely no longer be hovered by
    // the time the drag ends — dragging a card far up and releasing it
    // there means the cursor isn't anywhere near the group any more. In
    // that case the fan is about to revert to its rest state the instant
    // .forced-open comes off below anyway, so computing (and leaving
    // behind, as inline styles) a flex-row fan position for it here would
    // immediately go stale: position:absolute would take back over from
    // CSS while margin-left/transform values that only meant anything in
    // flex-row context stayed applied — landing the card wherever that
    // mismatch happened to put it, which could read as "jumped into the
    // main fan". Checking real, current hover state (not just relying on
    // .forced-open, which is exactly the flag about to be cleared) decides
    // which one is actually correct to leave this card in.
    const substack = card.closest(".hand-card-substack");
    const groupCard = substack?.parentElement;
    const groupStillHovered = groupCard?.matches(":hover") ?? true;

    if (substack && !groupStillHovered) {
      resetSubstackLayout(substack);
    } else {
      // .closest finds the enclosing fan regardless of which one this card
      // lives in (main hand, a feature group's sub-stack, or its overlay)
      // — they're all just ".card-hand-list" as far as this is concerned.
      // Re-running the fan layout rather than just clearing zIndex to ""
      // matters here too — clearing it reverts this one card to "auto"
      // while its siblings keep their explicit fan-assigned zIndex, which
      // visually looks like the hand's order got scrambled even though
      // nothing actually moved.
      const list = card.closest(".card-hand-list");
      if (list) applyCardHandFanLayout(list);
    }

    // Release the substack from forced-fan-mode (see onStart) now that the
    // block above has already decided, correctly, which state this card
    // should actually be left in — from here it's fine for CSS :hover to
    // take back over deciding whether the group's fan should still be
    // showing at all.
    substack?.classList.remove("forced-open");

    // The overlay sits centered on screen, so "played" there can't mean
    // "dragged up" the way it does for the docked hand (up is arbitrary
    // relative to a centered fan) — instead it's just minimum distance
    // traveled from its resting spot in any direction.
    const inOverlay = !!card.closest(".card-hand-group-overlay-fan");
    const traveled = inOverlay ? Math.hypot(totalDx, totalDy) : -totalDy;

    if (traveled > 100) await useHandCard(card, actor);
  };

  const onStart = (event) => {
    if (event.type === "mousedown" && event.button !== 0) return;
    // A feature-group card nests real mini .hand-cards inside its own
    // sub-stack, each with their own independent attachGrabGesture — without
    // this, a mousedown on a mini card bubbled up through the DOM and ALSO
    // triggered the parent card's own mousedown listener, starting both
    // drags at once. On release, both onEnd handlers fired too, so using a
    // specific feature ended up also "using" its parent group (opening the
    // overlay) at the same time — "the whole stack goes into play."
    event.stopPropagation();
    dragging = true;
    const point = event.touches ? event.touches[0] : event;
    startX = point.clientX;
    startY = point.clientY;
    baseTransform = card.style.transform || "";
    counterRotateDeg = getAncestorRotationDeg(card);

    // Keeps a member card's own group fan in real flex-row layout for the
    // whole drag, regardless of where the cursor wanders — without this,
    // dragging a card up and over the main fan (which sits at a higher
    // z-index than the substack's own resting z:2) could make the dragged
    // card lose CSS :hover entirely partway through, since it stops winning
    // hit-testing against whatever main-fan card it's currently over. Once
    // that ancestor :hover state is gone, the substack's own :hover-scoped
    // rules (position:relative, the fan layout itself) stop applying, and
    // onEnd's fan re-layout — written assuming flex-row positioning — lands
    // on an element that's silently back in the rest state's
    // position:absolute instead, which is what made a released child look
    // like it had jumped into the main fan. See card-hand.css for the
    // .forced-open rules this toggles.
    card.closest(".hand-card-substack")?.classList.add("forced-open");

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.body.classList.add("dragging-active");

    if (event.type === "touchstart") event.preventDefault();
  };

  card.addEventListener("mousedown", onStart);
  card.addEventListener("touchstart", onStart, { passive: false });
}

// ─── DRAG-TO-CANVAS ───────────────────────────────────────────────────────────
// Optional extra, independent of the in-hand drag-up gesture above — kept
// for any owned item dragged via Foundry's own native drag elsewhere (e.g.
// from the full sheet), unrelated to the hand.

export function registerCardHandRuntimeHooks() {
  Hooks.on("dropCanvasData", async (_canvas, data) => {
    if (data?.type !== "Item" || !data.uuid) return;

    const item = await fromUuid(data.uuid);
    if (!item?.parent) return;

    const controlled = canvas.tokens?.controlled ?? [];
    if (!controlled.some((token) => token.actor?.id === item.parent.id)) return;

    if (typeof item.use === "function") {
      await item.use({});
    } else if (typeof item.roll === "function") {
      await item.roll({});
    } else if (typeof item.toChat === "function") {
      await item.toChat(item.uuid);
    }
  });
}
