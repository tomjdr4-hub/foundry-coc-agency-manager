import {
  MODULE_ID,
  VISIBILITY_ALL,
  getData,
  saveData,
  mutate,
  getPlayerUsers,
  isVisibleTo,
  isVisibleToAll,
  isVisibleToUser,
  toggleVisibilityAll,
  toggleVisibilityUser,
  newSession,
  newHandout,
  newNpcEntry,
  newSociety,
  newOffice,
  newEquipmentItem,
  newOrder,
  newRelationship,
  findSession,
  findHandout,
  findNpc,
  findSociety,
  findOffice,
  findEquipmentItem,
  findOrder,
  pushRevealLogEntry,
  unassignActorEverywhere
} from "../data.js";
import {
  getDroppedDocumentData,
  resolveActor,
  resolveItem,
  resolveScene,
  resolveHandoutDisplay,
  openSessionNotesJournal,
  ensureNpcNotePage,
  pickImage
} from "../helpers.js";
import { pushHandoutToPlayers, requestNpcNotePage, markItemsSeen, requestEquipmentOrder } from "../socket.js";
import { HandoutLightboxApp } from "./lightbox-app.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export class AgencyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "coc-agency-app",
    window: {
      title: "COCAGENCY.App.Title",
      icon: "fa-solid fa-user-secret",
      contentClasses: ["coc-agency-app"],
      resizable: true
    },
    position: { width: 1000, height: 720 },
    actions: {
      setTab: this.prototype.setTab,
      createSession: this.prototype.createSession,
      selectSession: this.prototype.selectSession,
      deleteSession: this.prototype.deleteSession,
      toggleSessionAll: this.prototype.toggleSessionAll,
      toggleSessionUser: this.prototype.toggleSessionUser,
      addHandoutImage: this.prototype.addHandoutImage,
      addHandoutJournal: this.prototype.addHandoutJournal,
      deleteHandout: this.prototype.deleteHandout,
      showHandout: this.prototype.showHandout,
      toggleHandoutAll: this.prototype.toggleHandoutAll,
      toggleHandoutUser: this.prototype.toggleHandoutUser,
      removeNpc: this.prototype.removeNpc,
      toggleNpcAll: this.prototype.toggleNpcAll,
      toggleNpcUser: this.prototype.toggleNpcUser,
      openActorSheet: this.prototype.openActorSheet,
      openSessionNotes: this.prototype.openSessionNotes,
      openNpcNotes: this.prototype.openNpcNotes,
      createSociety: this.prototype.createSociety,
      selectSociety: this.prototype.selectSociety,
      deleteSociety: this.prototype.deleteSociety,
      setSocietyImage: this.prototype.setSocietyImage,
      setSocietyMap: this.prototype.setSocietyMap,
      addOffice: this.prototype.addOffice,
      selectOffice: this.prototype.selectOffice,
      deleteOffice: this.prototype.deleteOffice,
      setOfficeImage: this.prototype.setOfficeImage,
      toggleOfficeAll: this.prototype.toggleOfficeAll,
      toggleOfficeUser: this.prototype.toggleOfficeUser,
      removeOfficeNpc: this.prototype.removeOfficeNpc,
      startPlacingOffice: this.prototype.startPlacingOffice,
      removeOfficeAssignment: this.prototype.removeOfficeAssignment,
      linkScene: this.prototype.linkScene,
      unlinkScene: this.prototype.unlinkScene,
      activateScene: this.prototype.activateScene,
      deleteEquipmentItem: this.prototype.deleteEquipmentItem,
      orderEquipment: this.prototype.orderEquipment,
      setOrderStatus: this.prototype.setOrderStatus,
      deleteOrder: this.prototype.deleteOrder,
      addRelationship: this.prototype.addRelationship,
      deleteRelationship: this.prototype.deleteRelationship,
      jumpToResult: this.prototype.jumpToResult,
      exportData: this.prototype.exportData,
      importData: this.prototype.importData
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/agency-app.hbs` }
  };

  state = {
    tab: "sessions",
    selectedSessionId: null,
    selectedSocietyId: null,
    selectedOfficeId: null,
    placingOffice: false,
    searchQuery: "",
    searchFocusPending: false
  };

  #pendingSeen = new Set();

  static #openInstances = new Set();

  /** Re-renders every currently open AgencyApp window (used when the shared world data changes). */
  static refreshOpen() {
    for (const app of AgencyApp.#openInstances) app.render();
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    AgencyApp.#openInstances.add(this);
  }

  _onClose(options) {
    super._onClose(options);
    AgencyApp.#openInstances.delete(this);
  }

  async _prepareContext() {
    const user = game.user;
    const isGM = user.isGM;
    const players = getPlayerUsers().map((p) => ({ id: p.id, name: p.name }));
    const allPlayerIds = players.map((p) => p.id);
    const data = getData();

    const sessions = data.sessions
      .filter((s) => isGM || isVisibleTo(s, user))
      .sort((a, b) => a.order - b.order)
      .map((s) => this._sessionVM(s, isGM, user, players));

    if (!sessions.find((s) => s.id === this.state.selectedSessionId)) {
      this.state.selectedSessionId = sessions[0]?.id ?? null;
    }

    const societies = data.societies.map((soc) => this._societyVM(soc, isGM, user, players));
    if (!societies.find((s) => s.id === this.state.selectedSocietyId)) {
      this.state.selectedSocietyId = societies[0]?.id ?? null;
    }
    const selectedSociety = societies.find((s) => s.id === this.state.selectedSocietyId) ?? null;
    if (selectedSociety && !selectedSociety.offices.find((o) => o.id === this.state.selectedOfficeId)) {
      this.state.selectedOfficeId = selectedSociety.offices[0]?.id ?? null;
    }

    return {
      isGM,
      players,
      tab: this.state.tab,
      sessions,
      selectedSessionId: this.state.selectedSessionId,
      selectedSession: sessions.find((s) => s.id === this.state.selectedSessionId) ?? null,
      societies,
      selectedSocietyId: this.state.selectedSocietyId,
      selectedSociety,
      selectedOfficeId: this.state.selectedOfficeId,
      selectedOffice: selectedSociety?.offices.find((o) => o.id === this.state.selectedOfficeId) ?? null,
      placingOffice: this.state.placingOffice,
      network: isGM ? this._networkVM(data) : null,
      searchQuery: this.state.searchQuery,
      searchResults: this._computeSearchResults(sessions, societies)
    };
  }

  _computeSearchResults(sessions, societies) {
    const query = this.state.searchQuery?.trim().toLowerCase();
    if (!query) return [];
    const results = [];
    for (const session of sessions) {
      for (const h of session.handouts) {
        if (h.title.toLowerCase().includes(query)) {
          results.push({ type: "handout", label: h.title, parent: session.name, sessionId: session.id });
        }
      }
      for (const n of session.npcs) {
        if (n.name.toLowerCase().includes(query)) {
          results.push({ type: "npc", label: n.name, parent: session.name, sessionId: session.id });
        }
      }
    }
    for (const society of societies) {
      for (const o of society.offices) {
        if (o.name.toLowerCase().includes(query)) {
          results.push({ type: "office", label: o.name, parent: society.name, societyId: society.id, officeId: o.id });
        }
      }
      for (const e of society.equipment) {
        if (e.name.toLowerCase().includes(query)) {
          results.push({ type: "equipment", label: e.name, parent: society.name, societyId: society.id });
        }
      }
    }
    return results.slice(0, 20);
  }

  /**
   * Builds the visual network of tracked NPCs (nodes on a circle) and their relationships (edges).
   * GM-only feature: always computed from the full dataset, with no player visibility filtering.
   */
  _networkVM(data) {
    const nodesMap = new Map();
    const addNode = (actorUuid) => {
      if (!actorUuid || nodesMap.has(actorUuid)) return;
      const actor = resolveActor(actorUuid);
      nodesMap.set(actorUuid, {
        actorUuid,
        name: actor?.name ?? game.i18n.localize("COCAGENCY.Npc.Unknown"),
        img: actor?.img ?? "icons/svg/mystery-man.svg",
        canOpen: !!actor
      });
    };

    for (const session of data.sessions) {
      for (const npc of session.npcs) addNode(npc.actorUuid);
    }
    for (const society of data.societies) {
      for (const office of society.offices) {
        for (const uuid of office.npcUuids) addNode(uuid);
      }
    }

    const nodes = Array.from(nodesMap.values());
    const total = Math.max(nodes.length, 1);
    const radius = 38;
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      node.x = Math.round((50 + radius * Math.cos(angle)) * 10) / 10;
      node.y = Math.round((50 + radius * Math.sin(angle)) * 10) / 10;
    });

    const edges = data.npcRelationships
      .filter((r) => nodesMap.has(r.fromActorUuid) && nodesMap.has(r.toActorUuid))
      .map((r) => {
        const from = nodesMap.get(r.fromActorUuid);
        const to = nodesMap.get(r.toActorUuid);
        return {
          id: r.id,
          label: r.label,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          midX: Math.round(((from.x + to.x) / 2) * 10) / 10,
          midY: Math.round(((from.y + to.y) / 2) * 10) / 10
        };
      });

    return { nodes, edges, hasNodes: nodes.length > 0 };
  }

  _sessionVM(session, isGM, user, players) {
    return {
      id: session.id,
      name: session.name,
      journalUuid: session.journalUuid,
      recap: session.recap,
      scenes: isGM
        ? session.sceneUuids.map((uuid) => ({ uuid, name: resolveScene(uuid)?.name ?? "?" }))
        : [],
      visibleAll: isVisibleToAll(session),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(session, p.id) })),
      handouts: session.handouts
        .filter((h) => isGM || isVisibleToUser(h, user.id))
        .map((h) => this._handoutVM(session.id, h, isGM, user, players)),
      npcs: session.npcs
        .filter((n) => isGM || isVisibleToUser(n, user.id))
        .map((n) => this._npcVM(session.id, n, isGM, user, players)),
      revealLog: session.revealLog.map((entry) => ({
        id: entry.id,
        handoutTitle: entry.handoutTitle,
        at: new Date(entry.at).toLocaleString(),
        targets:
          entry.targetUserIds === VISIBILITY_ALL
            ? game.i18n.localize("COCAGENCY.Visibility.All")
            : entry.targetUserIds.map((id) => game.users.get(id)?.name ?? "?").join(", ")
      }))
    };
  }

  _handoutVM(sessionId, handout, isGM, user, players) {
    const allPlayerIds = players.map((p) => p.id);
    const eligibleIds = handout.visibility === VISIBILITY_ALL ? allPlayerIds : handout.visibility;
    return {
      sessionId,
      id: handout.id,
      title: handout.title,
      kind: handout.kind,
      img: handout.img,
      pageUuid: handout.pageUuid,
      visibleAll: isVisibleToAll(handout),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(handout, p.id) })),
      isNew: !isGM && !handout.seenBy.includes(user.id),
      seenCount: eligibleIds.filter((id) => handout.seenBy.includes(id)).length,
      seenTotal: eligibleIds.length
    };
  }

  _npcVM(sessionId, npc, isGM, user, players) {
    const actor = resolveActor(npc.actorUuid);
    const allPlayerIds = players.map((p) => p.id);
    const eligibleIds = npc.visibility === VISIBILITY_ALL ? allPlayerIds : npc.visibility;
    return {
      sessionId,
      id: npc.id,
      actorUuid: npc.actorUuid,
      note: npc.note,
      name: actor?.name ?? game.i18n.localize("COCAGENCY.Npc.Unknown"),
      img: actor?.img ?? "icons/svg/mystery-man.svg",
      canOpen: !!actor && (isGM || actor.testUserPermission(user, "LIMITED")),
      visibleAll: isVisibleToAll(npc),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(npc, p.id) })),
      isNew: !isGM && !npc.seenBy.includes(user.id),
      seenCount: eligibleIds.filter((id) => npc.seenBy.includes(id)).length,
      seenTotal: eligibleIds.length
    };
  }

  _societyVM(society, isGM, user, players) {
    return {
      id: society.id,
      name: society.name,
      description: society.description,
      img: society.img,
      mapImage: society.mapImage,
      offices: society.offices
        .filter((o) => isGM || isVisibleTo(o, user))
        .map((o) => this._officeVM(society.id, o, players, isGM, user)),
      equipment: society.equipment.map((e) => {
        const item = resolveItem(e.itemUuid);
        return {
          societyId: society.id,
          id: e.id,
          note: e.note,
          name: item?.name ?? game.i18n.localize("COCAGENCY.Equipment.Unknown"),
          img: item?.img ?? "icons/svg/item-bag.svg"
        };
      }),
      orders: society.orders
        .filter((o) => isGM || o.requestedBy === user.id)
        .map((o) => ({
          ...o,
          societyId: society.id,
          statusLabel: game.i18n.localize(`COCAGENCY.Equipment.Status${o.status.charAt(0).toUpperCase()}${o.status.slice(1)}`)
        }))
        .sort((a, b) => b.requestedAt - a.requestedAt)
    };
  }

  _officeVM(societyId, office, players, isGM, user) {
    return {
      societyId,
      id: office.id,
      name: office.name,
      location: office.location,
      description: office.description,
      img: office.img,
      x: office.x,
      y: office.y,
      hasPin: office.x !== null && office.y !== null,
      visibleAll: isVisibleToAll(office),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(office, p.id) })),
      npcs: office.npcUuids.map((uuid) => {
        const actor = resolveActor(uuid);
        return { uuid, name: actor?.name ?? "?", img: actor?.img ?? "icons/svg/mystery-man.svg" };
      }),
      assignedActors: office.assignedActorUuids.map((uuid) => {
        const actor = resolveActor(uuid);
        return {
          uuid,
          name: actor?.name ?? "?",
          img: actor?.img ?? "icons/svg/mystery-man.svg",
          isMine: !!actor && !isGM && actor.testUserPermission(user, "OWNER")
        };
      })
    };
  }

  _onRender(context, options) {
    for (const el of this.element.querySelectorAll("[data-field]")) {
      el.addEventListener("change", (event) => this.onFieldChange(event));
    }
    for (const el of this.element.querySelectorAll("[data-dropzone='session-npc']")) {
      el.addEventListener("dragover", (event) => event.preventDefault());
      el.addEventListener("drop", (event) => this.onDropSessionNpc(event, el.dataset.sessionId));
    }
    for (const el of this.element.querySelectorAll("[data-dropzone='office-npc']")) {
      el.addEventListener("dragover", (event) => event.preventDefault());
      el.addEventListener("drop", (event) => this.onDropOfficeNpc(event, el.dataset.societyId, el.dataset.officeId));
    }
    for (const el of this.element.querySelectorAll("[data-dropzone='equipment']")) {
      el.addEventListener("dragover", (event) => event.preventDefault());
      el.addEventListener("drop", (event) => this.onDropEquipment(event, el.dataset.societyId));
    }
    for (const el of this.element.querySelectorAll("[data-dropzone='office-assignment']")) {
      el.addEventListener("dragover", (event) => event.preventDefault());
      el.addEventListener("drop", (event) => this.onDropOfficeAssignment(event, el.dataset.societyId, el.dataset.officeId));
    }
    for (const el of this.element.querySelectorAll("[data-map]")) {
      el.addEventListener("click", (event) => this.onMapClick(event, el));
    }

    const searchInput = this.element.querySelector("[data-search-input]");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => this.onSearchInput(event));
      if (this.state.searchFocusPending) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        this.state.searchFocusPending = false;
      }
    }

    const importInput = this.element.querySelector("[data-file-input='import']");
    importInput?.addEventListener("change", (event) => this.onImportFileChange(event));

    if (!game.user.isGM) this._autoMarkSeen(context);
  }

  /** Reports newly-visible handouts/NPCs as seen (batched per session) so the "new" badge clears everywhere. */
  _autoMarkSeen(context) {
    for (const session of context.sessions) {
      const handoutIds = session.handouts
        .filter((h) => h.isNew && !this.#pendingSeen.has(`h:${h.id}`))
        .map((h) => h.id);
      const npcIds = session.npcs.filter((n) => n.isNew && !this.#pendingSeen.has(`n:${n.id}`)).map((n) => n.id);
      handoutIds.forEach((id) => this.#pendingSeen.add(`h:${id}`));
      npcIds.forEach((id) => this.#pendingSeen.add(`n:${id}`));
      if (handoutIds.length || npcIds.length) markItemsSeen(session.id, handoutIds, npcIds);
    }
  }

  onSearchInput(event) {
    this.state.searchQuery = event.currentTarget.value;
    this.state.searchFocusPending = true;
    this.render();
  }

  jumpToResult(event, target) {
    const { type, sessionId, societyId, officeId } = target.dataset;
    this.state.searchQuery = "";
    if (type === "handout" || type === "npc") {
      this.state.tab = "sessions";
      this.state.selectedSessionId = sessionId;
    } else if (type === "office" || type === "equipment") {
      this.state.tab = "society";
      this.state.selectedSocietyId = societyId;
      if (officeId) this.state.selectedOfficeId = officeId;
    }
    this.render();
  }

  /* -------------------------------------------- */
  /* Generic field editing                          */
  /* -------------------------------------------- */

  async onFieldChange(event) {
    const el = event.currentTarget;
    const { field, sessionId, handoutId, npcId, societyId, officeId, itemId, orderId } = el.dataset;
    const value = el.type === "checkbox" ? el.checked : el.value;
    await mutate((data) => {
      let obj = null;
      if (officeId && societyId) obj = findOffice(data, societyId, officeId);
      else if (itemId && societyId) obj = findEquipmentItem(data, societyId, itemId);
      else if (orderId && societyId) obj = findOrder(data, societyId, orderId);
      else if (npcId && sessionId) obj = findNpc(data, sessionId, npcId);
      else if (handoutId && sessionId) obj = findHandout(data, sessionId, handoutId);
      else if (societyId) obj = findSociety(data, societyId);
      else if (sessionId) obj = findSession(data, sessionId);
      if (obj) foundry.utils.setProperty(obj, field, value);
    });
    this.render();
  }

  /* -------------------------------------------- */
  /* Tabs                                           */
  /* -------------------------------------------- */

  setTab(event, target) {
    this.state.tab = target.dataset.tab;
    this.render();
  }

  /* -------------------------------------------- */
  /* Sessions                                       */
  /* -------------------------------------------- */

  async createSession() {
    const data = await mutate((d) => d.sessions.push(newSession()));
    this.state.selectedSessionId = data.sessions.at(-1).id;
    this.render();
  }

  selectSession(event, target) {
    this.state.selectedSessionId = target.dataset.sessionId;
    this.render();
  }

  async deleteSession(event, target) {
    const { sessionId } = target.dataset;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("COCAGENCY.Session.DeleteTitle") },
      content: `<p>${game.i18n.localize("COCAGENCY.Session.DeleteConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await mutate((data) => {
      data.sessions = data.sessions.filter((s) => s.id !== sessionId);
    });
    if (this.state.selectedSessionId === sessionId) this.state.selectedSessionId = null;
    this.render();
  }

  async toggleSessionAll(event, target) {
    const { sessionId } = target.dataset;
    await mutate((data) => {
      const s = findSession(data, sessionId);
      if (s) toggleVisibilityAll(s);
    });
    this.render();
  }

  async toggleSessionUser(event, target) {
    const { sessionId, userId } = target.dataset;
    const allIds = getPlayerUsers().map((u) => u.id);
    await mutate((data) => {
      const s = findSession(data, sessionId);
      if (s) toggleVisibilityUser(s, userId, allIds);
    });
    this.render();
  }

  async openSessionNotes(event, target) {
    const { sessionId } = target.dataset;
    const session = findSession(getData(), sessionId);
    if (!session) return;
    await openSessionNotesJournal(session, (fn) => mutate((d) => fn(findSession(d, sessionId))));
  }

  /**
   * Opens the current user's private note page for a given NPC, creating it on first use.
   * Journal creation needs GM-level permission, so a non-GM player's request is relayed to a
   * connected GM's client via socket; the GM never sees or edits that page's content.
   */
  async openNpcNotes(event, target) {
    const { sessionId, npcId } = target.dataset;
    if (game.user.isGM) {
      const session = findSession(getData(), sessionId);
      const npc = findNpc(getData(), sessionId, npcId);
      if (!session || !npc) return;
      const page = await ensureNpcNotePage(session, npc, game.user, (fn) => mutate((d) => fn(findSession(d, sessionId))));
      page.sheet.render(true);
      return;
    }
    if (!game.users.some((u) => u.isGM && u.active)) {
      ui.notifications.warn(game.i18n.localize("COCAGENCY.Npc.NoGMOnline"));
      return;
    }
    requestNpcNotePage(sessionId, npcId);
    ui.notifications.info(game.i18n.localize("COCAGENCY.Npc.NoteRequested"));
  }

  /* -------------------------------------------- */
  /* Handouts                                       */
  /* -------------------------------------------- */

  async addHandoutImage(event, target) {
    const { sessionId } = target.dataset;
    const path = await pickImage();
    if (!path) return;
    await mutate((data) => {
      findSession(data, sessionId)?.handouts.push(newHandout({ kind: "image", img: path, title: path.split("/").pop() }));
    });
    this.render();
  }

  async addHandoutJournal(event, target) {
    const { sessionId } = target.dataset;
    const options = this._buildJournalPageOptions();
    if (!options) {
      ui.notifications.warn(game.i18n.localize("COCAGENCY.Handout.NoJournalPages"));
      return;
    }
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("COCAGENCY.Handout.PickJournalTitle") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("COCAGENCY.Handout.Title")}</label>
          <input type="text" name="title" placeholder="${game.i18n.localize("COCAGENCY.Handout.NewName")}" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("COCAGENCY.Handout.PickPage")}</label>
          <select name="pageUuid">${options}</select>
        </div>`,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("COCAGENCY.Common.Add"),
          default: true,
          callback: (ev, button) => new FormDataExtended(button.form).object
        },
        { action: "cancel", label: game.i18n.localize("COCAGENCY.Common.Cancel") }
      ],
      rejectClose: false
    });
    if (!result?.pageUuid) return;
    await mutate((data) => {
      findSession(data, sessionId)?.handouts.push(newHandout({ title: result.title, kind: "journal", pageUuid: result.pageUuid }));
    });
    this.render();
  }

  _buildJournalPageOptions() {
    let html = "";
    for (const entry of game.journal) {
      if (entry.pages.size === 0) continue;
      html += `<optgroup label="${escapeHTML(entry.name)}">`;
      for (const page of entry.pages) {
        html += `<option value="${page.uuid}">${escapeHTML(page.name)}</option>`;
      }
      html += "</optgroup>";
    }
    return html;
  }

  async deleteHandout(event, target) {
    const { sessionId, handoutId } = target.dataset;
    await mutate((data) => {
      const session = findSession(data, sessionId);
      if (session) session.handouts = session.handouts.filter((h) => h.id !== handoutId);
    });
    this.render();
  }

  async showHandout(event, target) {
    const { sessionId, handoutId } = target.dataset;
    const handout = findHandout(getData(), sessionId, handoutId);
    if (!handout) return;
    const display = await resolveHandoutDisplay(handout);
    pushHandoutToPlayers(display, handout.visibility);
    await mutate((data) => {
      const session = findSession(data, sessionId);
      if (session) {
        pushRevealLogEntry(session, { handoutTitle: handout.title, targetUserIds: handout.visibility });
      }
    });
    new HandoutLightboxApp(display).render(true);
  }

  async toggleHandoutAll(event, target) {
    const { sessionId, handoutId } = target.dataset;
    await mutate((data) => {
      const h = findHandout(data, sessionId, handoutId);
      if (h) toggleVisibilityAll(h);
    });
    this.render();
  }

  async toggleHandoutUser(event, target) {
    const { sessionId, handoutId, userId } = target.dataset;
    const allIds = getPlayerUsers().map((u) => u.id);
    await mutate((data) => {
      const h = findHandout(data, sessionId, handoutId);
      if (h) toggleVisibilityUser(h, userId, allIds);
    });
    this.render();
  }

  /* -------------------------------------------- */
  /* NPCs                                           */
  /* -------------------------------------------- */

  async onDropSessionNpc(event, sessionId) {
    event.preventDefault();
    const dropped = getDroppedDocumentData(event);
    if (dropped?.type !== "Actor") return;
    const actor = await fromUuid(dropped.uuid);
    if (!actor) return;
    await mutate((data) => {
      const session = findSession(data, sessionId);
      if (session && !session.npcs.some((n) => n.actorUuid === dropped.uuid)) {
        session.npcs.push(newNpcEntry({ actorUuid: dropped.uuid }));
      }
    });
    this.render();
  }

  async removeNpc(event, target) {
    const { sessionId, npcId } = target.dataset;
    await mutate((data) => {
      const session = findSession(data, sessionId);
      if (session) session.npcs = session.npcs.filter((n) => n.id !== npcId);
    });
    this.render();
  }

  async toggleNpcAll(event, target) {
    const { sessionId, npcId } = target.dataset;
    await mutate((data) => {
      const n = findNpc(data, sessionId, npcId);
      if (n) toggleVisibilityAll(n);
    });
    this.render();
  }

  async toggleNpcUser(event, target) {
    const { sessionId, npcId, userId } = target.dataset;
    const allIds = getPlayerUsers().map((u) => u.id);
    await mutate((data) => {
      const n = findNpc(data, sessionId, npcId);
      if (n) toggleVisibilityUser(n, userId, allIds);
    });
    this.render();
  }

  async openActorSheet(event, target) {
    resolveActor(target.dataset.actorUuid)?.sheet?.render(true);
  }

  /* -------------------------------------------- */
  /* Societies                                      */
  /* -------------------------------------------- */

  async createSociety() {
    const data = await mutate((d) => d.societies.push(newSociety()));
    this.state.selectedSocietyId = data.societies.at(-1).id;
    this.render();
  }

  selectSociety(event, target) {
    this.state.selectedSocietyId = target.dataset.societyId;
    this.state.selectedOfficeId = null;
    this.render();
  }

  async deleteSociety(event, target) {
    const { societyId } = target.dataset;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("COCAGENCY.Society.DeleteTitle") },
      content: `<p>${game.i18n.localize("COCAGENCY.Society.DeleteConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await mutate((data) => {
      data.societies = data.societies.filter((s) => s.id !== societyId);
    });
    if (this.state.selectedSocietyId === societyId) this.state.selectedSocietyId = null;
    this.render();
  }

  async setSocietyImage(event, target) {
    const { societyId } = target.dataset;
    const current = findSociety(getData(), societyId)?.img ?? "";
    const path = await pickImage(current);
    if (path === undefined) return;
    await mutate((data) => {
      const s = findSociety(data, societyId);
      if (s) s.img = path;
    });
    this.render();
  }

  async setSocietyMap(event, target) {
    const { societyId } = target.dataset;
    const current = findSociety(getData(), societyId)?.mapImage ?? "";
    const path = await pickImage(current);
    if (path === undefined) return;
    await mutate((data) => {
      const s = findSociety(data, societyId);
      if (s) s.mapImage = path;
    });
    this.render();
  }

  /* -------------------------------------------- */
  /* Offices                                        */
  /* -------------------------------------------- */

  async addOffice(event, target) {
    const { societyId } = target.dataset;
    const data = await mutate((d) => {
      const society = findSociety(d, societyId);
      society?.offices.push(newOffice());
    });
    this.state.selectedOfficeId = findSociety(data, societyId).offices.at(-1).id;
    this.render();
  }

  selectOffice(event, target) {
    this.state.selectedOfficeId = target.dataset.officeId;
    this.state.placingOffice = false;
    this.render();
  }

  async deleteOffice(event, target) {
    const { societyId, officeId } = target.dataset;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("COCAGENCY.Office.DeleteTitle") },
      content: `<p>${game.i18n.localize("COCAGENCY.Office.DeleteConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await mutate((data) => {
      const society = findSociety(data, societyId);
      if (society) society.offices = society.offices.filter((o) => o.id !== officeId);
    });
    if (this.state.selectedOfficeId === officeId) this.state.selectedOfficeId = null;
    this.render();
  }

  async setOfficeImage(event, target) {
    const { societyId, officeId } = target.dataset;
    const current = findOffice(getData(), societyId, officeId)?.img ?? "";
    const path = await pickImage(current);
    if (path === undefined) return;
    await mutate((data) => {
      const o = findOffice(data, societyId, officeId);
      if (o) o.img = path;
    });
    this.render();
  }

  async toggleOfficeAll(event, target) {
    const { societyId, officeId } = target.dataset;
    await mutate((data) => {
      const o = findOffice(data, societyId, officeId);
      if (o) toggleVisibilityAll(o);
    });
    this.render();
  }

  async toggleOfficeUser(event, target) {
    const { societyId, officeId, userId } = target.dataset;
    const allIds = getPlayerUsers().map((u) => u.id);
    await mutate((data) => {
      const o = findOffice(data, societyId, officeId);
      if (o) toggleVisibilityUser(o, userId, allIds);
    });
    this.render();
  }

  async removeOfficeNpc(event, target) {
    const { societyId, officeId, actorUuid } = target.dataset;
    await mutate((data) => {
      const o = findOffice(data, societyId, officeId);
      if (o) o.npcUuids = o.npcUuids.filter((u) => u !== actorUuid);
    });
    this.render();
  }

  async onDropOfficeNpc(event, societyId, officeId) {
    event.preventDefault();
    const dropped = getDroppedDocumentData(event);
    if (dropped?.type !== "Actor") return;
    const actor = await fromUuid(dropped.uuid);
    if (!actor) return;
    await mutate((data) => {
      const office = findOffice(data, societyId, officeId);
      if (office && !office.npcUuids.includes(dropped.uuid)) office.npcUuids.push(dropped.uuid);
    });
    this.render();
  }

  async onDropOfficeAssignment(event, societyId, officeId) {
    event.preventDefault();
    const dropped = getDroppedDocumentData(event);
    if (dropped?.type !== "Actor") return;
    const actor = await fromUuid(dropped.uuid);
    if (!actor) return;
    await mutate((data) => {
      unassignActorEverywhere(data, dropped.uuid);
      const office = findOffice(data, societyId, officeId);
      office?.assignedActorUuids.push(dropped.uuid);
    });
    this.render();
  }

  async removeOfficeAssignment(event, target) {
    const { societyId, officeId, actorUuid } = target.dataset;
    await mutate((data) => {
      const o = findOffice(data, societyId, officeId);
      if (o) o.assignedActorUuids = o.assignedActorUuids.filter((u) => u !== actorUuid);
    });
    this.render();
  }

  startPlacingOffice() {
    this.state.placingOffice = true;
    this.render();
  }

  async onMapClick(event, mapEl) {
    if (!this.state.placingOffice) return;
    const rect = mapEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const { societyId } = mapEl.dataset;
    const officeId = this.state.selectedOfficeId;
    await mutate((data) => {
      const office = findOffice(data, societyId, officeId);
      if (office) {
        office.x = Math.round(x * 10) / 10;
        office.y = Math.round(y * 10) / 10;
      }
    });
    this.state.placingOffice = false;
    this.render();
  }

  /* -------------------------------------------- */
  /* Scene link                                     */
  /* -------------------------------------------- */

  async linkScene(event, target) {
    const { sessionId } = target.dataset;
    const session = findSession(getData(), sessionId);
    if (!session) return;
    const available = game.scenes.filter((s) => !session.sceneUuids.includes(s.uuid));
    if (!available.length) {
      ui.notifications.warn(game.i18n.localize("COCAGENCY.Session.NoScenes"));
      return;
    }
    const options = available.map((s) => `<option value="${s.uuid}">${escapeHTML(s.name)}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("COCAGENCY.Session.PickSceneTitle") },
      content: `<div class="form-group"><label>${game.i18n.localize("COCAGENCY.Session.Scene")}</label><select name="sceneUuid">${options}</select></div>`,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("COCAGENCY.Common.Add"),
          default: true,
          callback: (ev, button) => new FormDataExtended(button.form).object
        },
        { action: "cancel", label: game.i18n.localize("COCAGENCY.Common.Cancel") }
      ],
      rejectClose: false
    });
    if (!result?.sceneUuid) return;
    await mutate((data) => {
      const s = findSession(data, sessionId);
      if (s && !s.sceneUuids.includes(result.sceneUuid)) s.sceneUuids.push(result.sceneUuid);
    });
    this.render();
  }

  async unlinkScene(event, target) {
    const { sessionId, sceneUuid } = target.dataset;
    await mutate((data) => {
      const session = findSession(data, sessionId);
      if (session) session.sceneUuids = session.sceneUuids.filter((u) => u !== sceneUuid);
    });
    this.render();
  }

  async activateScene(event, target) {
    const { sceneUuid } = target.dataset;
    const scene = await fromUuid(sceneUuid);
    await scene?.activate();
  }

  /* -------------------------------------------- */
  /* Equipment & orders                             */
  /* -------------------------------------------- */

  async onDropEquipment(event, societyId) {
    event.preventDefault();
    const dropped = getDroppedDocumentData(event);
    if (dropped?.type !== "Item") return;
    const item = await fromUuid(dropped.uuid);
    if (!item) return;
    await mutate((data) => {
      const society = findSociety(data, societyId);
      if (society && !society.equipment.some((e) => e.itemUuid === dropped.uuid)) {
        society.equipment.push(newEquipmentItem({ itemUuid: dropped.uuid }));
      }
    });
    this.render();
  }

  async deleteEquipmentItem(event, target) {
    const { societyId, itemId } = target.dataset;
    await mutate((data) => {
      const society = findSociety(data, societyId);
      if (society) society.equipment = society.equipment.filter((e) => e.id !== itemId);
    });
    this.render();
  }

  /**
   * A player ordering equipment can't write world data directly, so the request is relayed to
   * a connected GM's client (same pattern as NPC note pages); the GM never needs to approve the
   * relay itself, only the resulting order.
   */
  async orderEquipment(event, target) {
    const { societyId, itemId } = target.dataset;
    if (game.user.isGM) {
      const item = findEquipmentItem(getData(), societyId, itemId);
      if (!item) return;
      const itemName = resolveItem(item.itemUuid)?.name ?? "?";
      await mutate((data) => {
        const society = findSociety(data, societyId);
        society?.orders.push(
          newOrder({ itemId: item.id, itemName, requestedBy: game.user.id, requestedByName: game.user.name })
        );
      });
      this.render();
      return;
    }
    if (!game.users.some((u) => u.isGM && u.active)) {
      ui.notifications.warn(game.i18n.localize("COCAGENCY.Equipment.NoGMOnline"));
      return;
    }
    requestEquipmentOrder(societyId, itemId);
    ui.notifications.info(game.i18n.localize("COCAGENCY.Equipment.OrderRequested"));
  }

  async setOrderStatus(event, target) {
    const { societyId, orderId, status } = target.dataset;
    await mutate((data) => {
      const order = findOrder(data, societyId, orderId);
      if (order) order.status = status;
    });
    this.render();
  }

  async deleteOrder(event, target) {
    const { societyId, orderId } = target.dataset;
    await mutate((data) => {
      const society = findSociety(data, societyId);
      if (society) society.orders = society.orders.filter((o) => o.id !== orderId);
    });
    this.render();
  }

  /* -------------------------------------------- */
  /* NPC relationship network                       */
  /* -------------------------------------------- */

  async addRelationship() {
    const { nodes } = this._networkVM(getData());
    if (nodes.length < 2) {
      ui.notifications.warn(game.i18n.localize("COCAGENCY.Network.NotEnoughNpcs"));
      return;
    }
    const options = nodes.map((n) => `<option value="${n.actorUuid}">${escapeHTML(n.name)}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("COCAGENCY.Network.AddRelationship") },
      content: `
        <div class="form-group"><label>${game.i18n.localize("COCAGENCY.Network.From")}</label><select name="fromActorUuid">${options}</select></div>
        <div class="form-group"><label>${game.i18n.localize("COCAGENCY.Network.To")}</label><select name="toActorUuid">${options}</select></div>
        <div class="form-group"><label>${game.i18n.localize("COCAGENCY.Network.Label")}</label>
          <input type="text" name="label" placeholder="${game.i18n.localize("COCAGENCY.Network.LabelPlaceholder")}" /></div>`,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("COCAGENCY.Common.Add"),
          default: true,
          callback: (ev, button) => new FormDataExtended(button.form).object
        },
        { action: "cancel", label: game.i18n.localize("COCAGENCY.Common.Cancel") }
      ],
      rejectClose: false
    });
    if (!result?.fromActorUuid || !result?.toActorUuid || result.fromActorUuid === result.toActorUuid) return;
    await mutate((data) => data.npcRelationships.push(newRelationship(result)));
    this.render();
  }

  async deleteRelationship(event, target) {
    const { relationshipId } = target.dataset;
    await mutate((data) => {
      data.npcRelationships = data.npcRelationships.filter((r) => r.id !== relationshipId);
    });
    this.render();
  }

  /* -------------------------------------------- */
  /* Export / Import                                */
  /* -------------------------------------------- */

  exportData() {
    const data = getData();
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", "coc-agency-manager.json");
  }

  importData() {
    this.element.querySelector("[data-file-input='import']")?.click();
  }

  async onImportFileChange(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      ui.notifications.error(game.i18n.localize("COCAGENCY.Export.InvalidFile"));
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("COCAGENCY.Export.ImportTitle") },
      content: `<p>${game.i18n.localize("COCAGENCY.Export.ImportConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await saveData(parsed);
    this.render();
  }
}
