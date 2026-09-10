import { FloatingTabs } from "../floating-tabs.js";
import {
  attachDieResourceListeners,
  attachQuantityListeners,
  attachSimpleResourceListeners,
  attachUsesResourceListeners,
  dismissHoverTooltip,
  getPartyMemberPips,
  getSortedPartyMembers,
  prepareActorInventoryData,
  resolveUnarmedAttack,
  resolveUsesUnarmed,
  setCardDescriptionOpen,
  toggleCardDescription,
} from "../helpers.js";

export function registerPartySheet() {
  if (game.system.id !== "daggerheart") return;

  const registeredSheets = CONFIG.Actor.sheetClasses.party || {};
  const daggerheartPartySheet = registeredSheets["daggerheart.PartySheet"];
  if (!daggerheartPartySheet) {
    console.warn("daggerheart-enhanced-ui | Could not find the system Party sheet to extend.");
    return;
  }

  const DaggerheartPartySheet = daggerheartPartySheet.cls;

  class EnhancedPartySheet extends DaggerheartPartySheet {
    tabs = {};
    floatingTabs = null;
    collapsedCategories = [];
    openCards = new Set();

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      super.DEFAULT_OPTIONS,
      {
        classes: ["daggerheart", "sheet", "actor", "enhanced-ui", "enhanced-party"],
        window: { title: "TYPES.Actor.party", controls: [] },
        position: { width: 650, height: 700 },
        actions: {
          toggleCategory: EnhancedPartySheet._onToggleCategory,
          toggleHope: EnhancedPartySheet._onToggleMemberHope,
          toggleHitPoints: EnhancedPartySheet._onToggleMemberHitPoints,
          toggleStress: EnhancedPartySheet._onToggleMemberStress,
          toggleArmorSlot: EnhancedPartySheet._onToggleMemberArmorSlot,
          openMemberSheet: EnhancedPartySheet._onOpenMemberSheet,
          deletePartyMember: EnhancedPartySheet._onDeletePartyMember,
          deleteItem: EnhancedPartySheet._onDeleteItem,
          modifyResource: EnhancedPartySheet._onModifyMemberResource,
        },
        dragDrop: [
          {
            dragSelector: "[data-item-uuid]",
            dropSelector: null,
          },
        ],
      },
      { inplace: false },
    );

    static PARTS = {
      mainSheet: {
        template: "modules/daggerheart-enhanced-ui/templates/sheets/party/party-sheet-main.hbs",
      },
      partyMembers: {
        template: "modules/daggerheart-enhanced-ui/templates/sheets/party/tabs/party-members.hbs",
      },
    };

    // ─── Context Preparation ──────────────────────────────────────────────────

    async _prepareContext(options) {
      if (!options.isFirstRender && this.element) {
        const mainSheet = this.element.querySelector(".tab-content");
        if (mainSheet) this._savedScrollPosition = mainSheet.scrollTop;
      }

      const context = await super._prepareContext(options);

      context.partySize = this.document.system.partyMembers?.length ?? 0;
      context.tabsPosition = game.settings.get("daggerheart-enhanced-ui", "tabsPosition");
      context.showTooltip = game.settings.get("daggerheart-enhanced-ui", "showTooltip");

      if (Object.keys(this.tabs).length === 0) {
        this.tabs = {
          partyMembers: {
            id: "partyMembers",
            label: game.i18n.localize("DAGGERHEART.GENERAL.Tabs.partyMembers"),
            icon: "fa-solid fa-users",
            active: true,
          },
          inventory: {
            id: "inventory",
            label: game.i18n.localize("DAGGERHEART.GENERAL.Tabs.inventory"),
            icon: "fa-solid fa-backpack",
            active: false,
          },
          notes: {
            id: "notes",
            label: game.i18n.localize("DAGGERHEART.GENERAL.Tabs.notes"),
            icon: "fa-solid fa-feather-pointed",
            active: false,
          },
        };
      }

      context.tabs = this.tabs;
      context.partyMembersData = await this._preparePartyMembersData();
      await this._prepareInventoryData(context);

      if (options.isFirstRender && this.collapsedCategories.length === 0) {
        this.collapsedCategories = this.document.getFlag("daggerheart-enhanced-ui", "collapsedCategories") || [];
      }
      context.collapsedCategories = this.collapsedCategories;

      const notesValue = foundry.utils.getProperty(this.document.system, "notes");
      context.notes = {
        field: this.document.system.schema.getField("notes"),
        value: notesValue,
        enriched: await foundry.applications.ux.TextEditor.implementation.enrichHTML(notesValue, {
          secrets: this.document.isOwner,
          relativeTo: this.document,
        }),
      };

      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (partId === "partyMembers") {
        context.partyMembersData = await this._preparePartyMembersData();
      }
      return context;
    }

    async _preparePartyMembersData() {
      const members = getSortedPartyMembers(this.document);
      const results = [];

      for (const actor of members) {
        const sys = actor.system;
        const { hope, hitPoints, stress, armorSlots } = getPartyMemberPips(actor);

        const evasion = sys.evasion ?? 0;
        const proficiency = sys.proficiency ?? "";
        const damageThresholds = {
          major: sys.damageThresholds?.major ?? 0,
          severe: sys.damageThresholds?.severe ?? 0,
        };

        const level = sys.levelData?.level?.changed ?? sys.levelData?.level?.value ?? 0;

        const attributes = Object.keys(sys.traits ?? {}).reduce((acc, key) => {
          acc[key] = {
            ...sys.traits[key],
            label: game.i18n.localize(CONFIG.DH.ACTOR.abilities[key].label),
            verbs: CONFIG.DH.ACTOR.abilities[key].verbs.map((x) => game.i18n.localize(x)),
            isSpellcasting: sys.spellcastModifierTrait?.key === key,
          };
          return acc;
        }, {});

        let primaryWeapon = null;
        let secondaryWeapon = null;

        if (actor.type === "character") {
          const equipped = actor.items.filter((i) => i.type === "weapon" && i.system.equipped);
          primaryWeapon = equipped.find((w) => !w.system.secondary) ?? null;

          if (primaryWeapon?.system.burden !== "twoHanded") {
            secondaryWeapon = equipped.find((w) => w.system.secondary) ?? null;
          }

          if (!primaryWeapon && resolveUsesUnarmed(actor)) {
            const unarmed = resolveUnarmedAttack(actor);
            if (unarmed) {
              primaryWeapon = {
                img: unarmed.img,
                name: game.i18n.localize(unarmed.name || "DAGGERHEART.GENERAL.unarmedAttack"),
              };
            }
          }
        }

        results.push({
          actor,
          attributes,
          level,
          hope,
          hitPoints,
          stress,
          armorSlots,
          evasion,
          proficiency,
          damageThresholds,
          primaryWeapon,
          secondaryWeapon,
          actorUuid: actor.uuid,
        });
      }

      return results;
    }

    async _prepareInventoryData(context) {
      const inventory = await prepareActorInventoryData(this.document);
      context.weapons = inventory.weapons;
      context.armors = inventory.armors;
      context.consumables = inventory.consumables;
      context.loots = inventory.loots;
    }

    // ─── Filter Menus ─────────────────────────────────────────────────────────

    _createFilterMenus() {}

    // ─── Rendering ───────────────────────────────────────────────────────────

    async _onRender(context, options) {
      await super._onRender(context, options);

      // Set after super so drag-drop binding (which may touch the element) runs first.
      this.element.id = "enhanced-ui-sheet";

      this.element.addEventListener("mousemove", dismissHoverTooltip);

      const tabsPosition = game.settings.get("daggerheart-enhanced-ui", "tabsPosition");

      if (tabsPosition === "floating") {
        if (!this.floatingTabs) {
          this.floatingTabs = new FloatingTabs(this, this.tabs);
          this.floatingTabs.render(true);
        } else {
          this.floatingTabs.tabs = this.tabs;
          this.floatingTabs.render(false, { parts: ["tabs"] });
        }
      } else {
        if (this.floatingTabs) {
          this.floatingTabs.close();
          this.floatingTabs = null;
        }
      }

      this._restoreCardStates();

      if (this._savedScrollPosition !== undefined) {
        const mainSheet = this.element.querySelector(".tab-content");
        if (mainSheet) mainSheet.scrollTop = this._savedScrollPosition;
      }
    }

    _restoreCardStates() {
      const mainSheet = this.element.querySelector(".tab-content");
      if (!mainSheet) return;

      this.openCards.forEach((uuid) => {
        const actorHeader = mainSheet.querySelector(`.card-container.header[data-actor-uuid="${uuid}"]`);
        if (actorHeader) {
          const description = actorHeader.closest(".card-wrapper")?.querySelector(".card-container.description");
          setCardDescriptionOpen(description, true, { animate: false });
        }

        const itemHeader = mainSheet.querySelector(`.card-container.header[data-item-uuid="${uuid}"]`);
        if (itemHeader) {
          const description = itemHeader.closest(".card-wrapper")?.querySelector(".card-container.description");
          setCardDescriptionOpen(description, true, { animate: false });
        }
      });
    }

    // ─── Part Listeners ───────────────────────────────────────────────────────

    _attachPartListeners(partId, htmlElement, options) {
      super._attachPartListeners?.(partId, htmlElement, options);
      this._attachBasicTabListeners(htmlElement);
      this._attachCardListeners(htmlElement);
      this._attachMemberPipListeners(htmlElement);
      this._attachResourceHeaderListeners(htmlElement);
      attachUsesResourceListeners(htmlElement);
      attachSimpleResourceListeners(htmlElement);
      attachDieResourceListeners(htmlElement);
      this._attachDiceResourceListeners(htmlElement);
      this._attachQuantityListeners(htmlElement);
    }

    _attachBasicTabListeners(htmlElement) {
      htmlElement.querySelectorAll(".basic-tabs .tab-button").forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          const tabId = btn.dataset.tab;

          Object.keys(this.tabs).forEach((key) => {
            this.tabs[key].active = key === tabId;
          });

          await this.render(false, { parts: ["mainSheet"] });
        });
      });
    }

    _attachCardListeners(htmlElement) {
      htmlElement.querySelectorAll(".card-text, .card-resource").forEach((nameContainer) => {
        nameContainer.addEventListener("click", (event) => {
          if (event.target.closest('.card-controls, [data-action="useItem"], .uses-resource, .simple-resource, .die-resource, .dice-resource, .recall-resource, .roll-damage, .quantity-resource, .resource-pip')) return;
          const cardWrapper = nameContainer.closest(".card-wrapper");
          if (!cardWrapper) return;
          const description = cardWrapper.querySelector(".card-container.description");
          if (!description) return;

          const isNowOpen = toggleCardDescription(description);

          const actorUuid = cardWrapper.querySelector("[data-actor-uuid]")?.dataset.actorUuid;
          const itemUuid = cardWrapper.dataset.itemUuid;
          const key = actorUuid || itemUuid;
          if (key) {
            if (isNowOpen) {
              this.openCards.add(key);
            } else {
              this.openCards.delete(key);
            }
          }
        });
      });
    }

    _attachMemberPipListeners(htmlElement) {
      const pipConfigs = [
        { action: "toggleHope", getPath: () => "system.resources.hope" },
        { action: "toggleHitPoints", getPath: () => "system.resources.hitPoints" },
        { action: "toggleStress", getPath: () => "system.resources.stress" },
      ];

      pipConfigs.forEach(({ action, getPath }) => {
        htmlElement.querySelectorAll(`[data-action="${action}"]`).forEach((pip) => {
          pip.addEventListener(
            "contextmenu",
            async (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
              const uuid = pip.dataset.actorUuid;
              const pipValue = parseInt(pip.dataset.value);
              if (!uuid || isNaN(pipValue)) return;
              const actor = await fromUuid(uuid);
              if (!actor) return;
              await actor.update({ [`${getPath()}.value`]: Math.max(0, pipValue - 1) });
            },
            true,
          );
        });
      });

      htmlElement.querySelectorAll('[data-action="toggleArmorSlot"]').forEach((pip) => {
        pip.addEventListener(
          "contextmenu",
          async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const actorUuid = pip.dataset.actorUuid;
            const pipValue = parseInt(pip.dataset.value);
            if (!actorUuid || isNaN(pipValue)) return;
            const actor = await fromUuid(actorUuid);
            if (!actor) return;
            const currentValue = actor.system.armorScore?.value ?? 0;
            const newValue = Math.max(0, pipValue - 1);
            const delta = newValue - currentValue;
            await actor.system.updateArmorValue({ value: delta });
            this.render(false, { parts: ["partyMembers"] });
          },
          true,
        );
      });
    }

    _attachResourceHeaderListeners(htmlElement) {
      htmlElement.querySelectorAll('[data-action="modifyResource"]').forEach((element) => {
        element.addEventListener(
          "contextmenu",
          async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const uuid = element.dataset.actorUuid;
            const resource = element.dataset.resource;
            const amount = parseInt(element.dataset.amount);
            if (!uuid || !resource || isNaN(amount)) return;
            const actor = await fromUuid(uuid);
            if (!actor) return;

            if (resource === "system.armorScore.value") {
              await actor.system.updateArmorValue({ value: -amount });
              this.render(false, { parts: ["partyMembers"] });
              return;
            }

            const fullPath = `system.resources.${resource}`;
            const currentValue = foundry.utils.getProperty(actor, fullPath);
            const newValue = Math.max(0, currentValue - amount);
            await actor.update({ [fullPath]: newValue });
          },
          true,
        );
      });

      htmlElement.querySelectorAll('[data-action="toggleArmorSlot"].resource-header, .resource-header[data-action="toggleArmorSlot"]').forEach((element) => {
        element.addEventListener(
          "contextmenu",
          async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const actorUuid = element.dataset.actorUuid;
            if (!actorUuid) return;
            const actor = await fromUuid(actorUuid);
            if (!actor) return;
            await actor.system.updateArmorValue({ value: -1 });
            this.render(false, { parts: ["partyMembers"] });
          },
          true,
        );
      });
    }

    _attachDiceResourceListeners(htmlElement) {
      htmlElement.querySelectorAll(".dice-resource").forEach((resource) => {
        resource.querySelectorAll(".dice-value").forEach((diceValue) => {
          diceValue.addEventListener("click", async (event) => {
            event.stopPropagation();
            const itemUuid = diceValue.closest("[data-item-uuid]")?.dataset.itemUuid;
            const item = await fromUuid(itemUuid);
            const diceIndex = diceValue.dataset.dice;
            const currentState = item.system.resource.diceStates[diceIndex];
            if (!currentState) return;
            await item.update({ [`system.resource.diceStates.${diceIndex}.used`]: !currentState.used });
          });
        });
      });
    }

    _attachQuantityListeners(htmlElement) {
      attachQuantityListeners(htmlElement);
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    static async _onToggleCategory(event, target) {
      const wrapper = target.closest(".category-wrapper");
      if (!wrapper) return;

      wrapper.classList.toggle("collapsed");

      const categoryId = wrapper.dataset.categoryId;
      if (!categoryId) return;

      const isCollapsed = wrapper.classList.contains("collapsed");

      if (isCollapsed) {
        if (!this.collapsedCategories.includes(categoryId)) this.collapsedCategories.push(categoryId);
      } else {
        const index = this.collapsedCategories.indexOf(categoryId);
        if (index > -1) this.collapsedCategories.splice(index, 1);
      }

      this.document.setFlag("daggerheart-enhanced-ui", "collapsedCategories", [...this.collapsedCategories]);
    }

    static async _onModifyMemberResource(event, target) {
      event.preventDefault();
      const uuid = target.dataset.actorUuid;
      const resource = target.dataset.resource;
      let amount = parseInt(target.dataset.amount);

      if (event.type === "contextmenu") amount = -amount;
      if (!uuid || !resource) return;

      if (resource === "system.armorScore.value") {
        const actor = await fromUuid(uuid);
        if (!actor) return;
        await actor.system.updateArmorValue({ value: amount });
        this.render(false, { parts: ["partyMembers"] });
        return;
      }

      const actor = await fromUuid(uuid);
      if (!actor) return;

      const fullPath = `system.resources.${resource}`;
      const maxPath = fullPath.replace(".value", ".max");
      const currentValue = foundry.utils.getProperty(actor, fullPath);
      const maxValue = foundry.utils.getProperty(actor, maxPath);
      const newValue = Math.max(0, Math.min(maxValue, currentValue + amount));

      await actor.update({ [fullPath]: newValue });
    }

    static async _onOpenMemberSheet(event, target) {
      const uuid = target.dataset.actorUuid;
      if (!uuid) return;
      const actor = await fromUuid(uuid);
      actor?.sheet?.render(true);
    }

    static async _onDeletePartyMember(event, target) {
      const uuid = target.dataset.actorUuid;
      if (!uuid) return;

      if (!event.shiftKey) {
        const actor = await fromUuid(uuid);
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: `Remove ${actor?.name ?? "member"} from party?` },
          content: `<p>Remove <strong>${actor?.name ?? "this member"}</strong> from the party sheet?</p>`,
        });
        if (!confirmed) return;
      }

      const currentUuids = this.document.system.partyMembers.map((x) => x.uuid);
      await this.document.update({
        "system.partyMembers": currentUuids.filter((u) => u !== uuid),
      });
    }

    static async _onDeleteItem(event, target) {
      const uuid = target.dataset.itemUuid;
      if (!uuid) return;

      const item = await fromUuid(uuid);
      if (!item) return;

      if (!event.shiftKey) {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.format("DAGGERHEART.APPLICATIONS.DeleteConfirmation.title", { type: game.i18n.localize(`TYPES.Item.${item.type}`), name: item.name }) },
          content: game.i18n.format("DAGGERHEART.APPLICATIONS.DeleteConfirmation.text", { name: item.name }),
        });
        if (!confirmed) return;
      }

      await item.delete();
    }

    static async _onToggleMemberHope(event, target) {
      const uuid = target.dataset.actorUuid;
      const pipValue = parseInt(target.dataset.value);
      if (!uuid || isNaN(pipValue)) return;

      const actor = await fromUuid(uuid);
      if (!actor) return;

      const current = actor.system.resources.hope.value;
      const newValue = pipValue === current ? current - 1 : pipValue;
      await actor.update({ "system.resources.hope.value": Math.max(0, newValue) });
    }

    static async _onToggleMemberHitPoints(event, target) {
      const uuid = target.dataset.actorUuid;
      const pipValue = parseInt(target.dataset.value);
      if (!uuid || isNaN(pipValue)) return;

      const actor = await fromUuid(uuid);
      if (!actor) return;

      const current = actor.system.resources.hitPoints.value;
      const newValue = pipValue === current ? current - 1 : pipValue;
      await actor.update({ "system.resources.hitPoints.value": Math.max(0, newValue) });
    }

    static async _onToggleMemberStress(event, target) {
      const uuid = target.dataset.actorUuid;
      const pipValue = parseInt(target.dataset.value);
      if (!uuid || isNaN(pipValue)) return;

      const actor = await fromUuid(uuid);
      if (!actor) return;

      const current = actor.system.resources.stress.value;
      const newValue = pipValue === current ? current - 1 : pipValue;
      await actor.update({ "system.resources.stress.value": Math.max(0, newValue) });
    }

    static async _onToggleMemberArmorSlot(event, target) {
      const uuid = target.dataset.actorUuid;
      const pipValue = parseInt(target.dataset.value);
      if (!uuid || isNaN(pipValue)) return;

      const actor = await fromUuid(uuid);
      if (!actor) return;

      const currentValue = actor.system.armorScore?.value ?? 0;
      const newValue = Math.max(0, pipValue === currentValue ? currentValue - 1 : pipValue);
      const delta = newValue - currentValue;
      await actor.system.updateArmorValue({ value: delta });
      this.render(false, { parts: ["partyMembers"] });
    }

    // ─── Drag & Drop ──────────────────────────────────────────────────────────

    _onDragStart(event) {
      const card = event.target.closest("[data-item-uuid]");
      if (!card) return;

      const itemUuid = card.dataset.itemUuid;
      const item = fromUuidSync(itemUuid);
      if (!item) return;

      if (item.parent === this.document) {
        EnhancedPartySheet.draggedItem = {
          itemId: item.id,
          actorId: this.document.id,
          itemName: item.name,
        };
      }

      const dragData = { type: "Item", uuid: item.uuid };
      if (item.parent) {
        dragData.actorId = item.parent.id;
        dragData.data = item.toObject();
      }

      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    async _onDrop(event) {
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if (!data) return;

      if (data.type === "Item") {
        const item = await fromUuid(data.uuid);
        if (!item) return;

        // Transfer from a character sheet onto the party sheet
        if (item.parent && item.parent.type === "character") {
          event.preventDefault();
          event.stopPropagation();
          const createdItems = await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
          if (createdItems?.length > 0) {
            await item.parent.deleteEmbeddedDocuments("Item", [item.id]);
            ui.notifications.info(`Transferred ${item.name} to ${this.document.name}`);
          }
          return false;
        }

        // Reorder within the party sheet
        if (item.parent === this.document) {
          event.preventDefault();
          event.stopPropagation();
          const dropTarget = event.target.closest(".card-wrapper");
          if (!dropTarget) return;
          const targetItem = await fromUuid(dropTarget.dataset.itemUuid);
          if (!targetItem || targetItem === item || item.type !== targetItem.type) return;
          const siblings = this.document.items.filter((i) => i.type === item.type).sort((a, b) => a.sort - b.sort);
          siblings.splice(siblings.indexOf(item), 1);
          siblings.splice(siblings.indexOf(targetItem), 0, item);
          await this.document.updateEmbeddedDocuments(
            "Item",
            siblings.map((s, i) => ({ _id: s.id, sort: (i + 1) * 100000 })),
          );
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
        return false;
      }

      if (data.type === "Actor") {
        const actor = data.uuid ? await fromUuid(data.uuid) : game.actors.get(data.id);
        if (actor) return this._onDropActor(event, actor);
      }
    }

    async _onDropActor(event, document) {
      const ALLOWED = ["character", "companion", "adversary"];

      if (document && ALLOWED.includes(document.type)) {
        const currentUuids = this.document.system.partyMembers.map((x) => x.uuid);
        if (currentUuids.includes(document.uuid)) {
          return ui.notifications.warn(game.i18n.localize("DAGGERHEART.UI.Notifications.duplicateCharacter"));
        }
        await this.document.update({
          "system.partyMembers": [...currentUuids, document.uuid],
        });
      } else {
        ui.notifications.warn(game.i18n.localize("DAGGERHEART.UI.Notifications.onlyCharactersInPartySheet"));
      }

      return null;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    async close(options = {}) {
      if (this.floatingTabs) {
        this.floatingTabs.close();
        this.floatingTabs = null;
      }
      return super.close(options);
    }
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "daggerheart", EnhancedPartySheet, {
    types: ["party"],
    makeDefault: true,
    label: "DH Enhanced UI",
  });

  EnhancedPartySheet.draggedItem = null;

  Hooks.on("preCreateItem", async (item, data, options, userId) => {
    if (!EnhancedPartySheet.draggedItem) return;
    if (userId !== game.user.id) return;

    const dragData = EnhancedPartySheet.draggedItem;

    if (item.parent?.type === "character" && item.parent?.id !== dragData.actorId) {
      setTimeout(async () => {
        const sourceActor = game.actors.get(dragData.actorId);
        if (sourceActor) {
          const sourceItem = sourceActor.items.get(dragData.itemId);
          if (sourceItem) {
            await sourceActor.deleteEmbeddedDocuments("Item", [dragData.itemId]);
            ui.notifications.info(`Transferred ${dragData.itemName} from ${sourceActor.name}`);
          }
        }
        EnhancedPartySheet.draggedItem = null;
      }, 50);
    }
  });

  document.addEventListener("dragend", () => {
    EnhancedPartySheet.draggedItem = null;
  });

  Hooks.on("updateActor", (actor) => {
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof EnhancedPartySheet)) continue;
      const isMember = app.document.system.partyMembers?.some((m) => m?.id === actor.id);
      if (isMember) app.render(false, { parts: ["partyMembers"] });
    }
  });

  Hooks.on("updateItem", (item) => {
    if (!item.parent) return;
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof EnhancedPartySheet)) continue;
      const isMember = app.document.system.partyMembers?.some((m) => m?.id === item.parent.id);
      if (isMember) app.render(false, { parts: ["partyMembers"] });
    }
  });

  Hooks.on("updateActiveEffect", (effect) => {
    const parentActor = effect.parent?.parent ?? effect.parent;
    if (!parentActor) return;
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof EnhancedPartySheet)) continue;
      const isMember = app.document.system.partyMembers?.some((m) => m?.id === parentActor.id);
      if (isMember) queueMicrotask(() => app.render(false, { parts: ["partyMembers"] }));
    }
  });
}
