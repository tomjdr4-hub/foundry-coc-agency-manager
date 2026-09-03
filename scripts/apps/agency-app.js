import {
  MODULE_ID,
  getData,
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
  findSession,
  findHandout,
  findNpc,
  findSociety,
  findOffice
} from "../data.js";
import {
  getDroppedDocumentData,
  resolveActor,
  resolveHandoutDisplay,
  openSessionNotesJournal,
  ensureNpcNotePage,
  pickImage
} from "../helpers.js";
import { pushHandoutToPlayers, requestNpcNotePage } from "../socket.js";
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
      startPlacingOffice: this.prototype.startPlacingOffice
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
    placingOffice: false
  };

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
      placingOffice: this.state.placingOffice
    };
  }

  _sessionVM(session, isGM, user, players) {
    return {
      id: session.id,
      name: session.name,
      journalUuid: session.journalUuid,
      visibleAll: isVisibleToAll(session),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(session, p.id) })),
      handouts: session.handouts
        .filter((h) => isGM || isVisibleToUser(h, user.id))
        .map((h) => this._handoutVM(session.id, h, players)),
      npcs: session.npcs
        .filter((n) => isGM || isVisibleToUser(n, user.id))
        .map((n) => this._npcVM(session.id, n, isGM, user, players))
    };
  }

  _handoutVM(sessionId, handout, players) {
    return {
      sessionId,
      id: handout.id,
      title: handout.title,
      kind: handout.kind,
      img: handout.img,
      pageUuid: handout.pageUuid,
      visibleAll: isVisibleToAll(handout),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(handout, p.id) }))
    };
  }

  _npcVM(sessionId, npc, isGM, user, players) {
    const actor = resolveActor(npc.actorUuid);
    return {
      sessionId,
      id: npc.id,
      actorUuid: npc.actorUuid,
      note: npc.note,
      name: actor?.name ?? game.i18n.localize("COCAGENCY.Npc.Unknown"),
      img: actor?.img ?? "icons/svg/mystery-man.svg",
      canOpen: !!actor && (isGM || actor.testUserPermission(user, "LIMITED")),
      visibleAll: isVisibleToAll(npc),
      playerChecks: players.map((p) => ({ ...p, checked: isVisibleToUser(npc, p.id) }))
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
        .map((o) => this._officeVM(society.id, o, players))
    };
  }

  _officeVM(societyId, office, players) {
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
    for (const el of this.element.querySelectorAll("[data-map]")) {
      el.addEventListener("click", (event) => this.onMapClick(event, el));
    }
  }

  /* -------------------------------------------- */
  /* Generic field editing                          */
  /* -------------------------------------------- */

  async onFieldChange(event) {
    const el = event.currentTarget;
    const { field, sessionId, handoutId, npcId, societyId, officeId } = el.dataset;
    const value = el.type === "checkbox" ? el.checked : el.value;
    await mutate((data) => {
      let obj = null;
      if (officeId && societyId) obj = findOffice(data, societyId, officeId);
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
}
