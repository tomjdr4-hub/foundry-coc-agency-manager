export const MODULE_ID = "coc-agency-manager";
export const SETTING_KEY = "agencyData";
export const SOCKET_NAME = `module.${MODULE_ID}`;

/** Visibility value used everywhere: "all" or an array of Foundry user ids. */
export const VISIBILITY_ALL = "all";

const REVEAL_LOG_LIMIT = 50;

function emptyData() {
  return {
    version: 1,
    sessions: [],
    societies: [],
    npcRelationships: []
  };
}

/**
 * Backfills fields added after a user's data was first created. `mergeObject` at the root
 * (see getData) only completes top-level keys, not fields inside objects already stored in
 * arrays (existing sessions/handouts/npcs/offices/societies), so this runs on every load.
 */
function normalize(data) {
  for (const session of data.sessions) {
    if (session.sceneUuid !== undefined) {
      session.sceneUuids = session.sceneUuid ? [session.sceneUuid] : [];
      delete session.sceneUuid;
    }
    session.sceneUuids ??= [];
    session.recap ??= "";
    session.revealLog ??= [];
    for (const handout of session.handouts) handout.seenBy ??= [];
    for (const npc of session.npcs) npc.seenBy ??= [];
  }
  for (const society of data.societies) {
    society.equipment ??= [];
    society.orders ??= [];
    for (const office of society.offices) office.assignedActorUuids ??= [];
  }
  return data;
}

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: emptyData()
  });
}

/** Returns a deep clone of the current world data, guaranteeing the expected shape. */
export function getData() {
  const raw = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
  const data = foundry.utils.mergeObject(emptyData(), raw, { inplace: false });
  data.sessions ??= [];
  data.societies ??= [];
  data.npcRelationships ??= [];
  return normalize(data);
}

/** Persists the given data object. GM-only: callers must guard with game.user.isGM. */
export async function saveData(data) {
  return game.settings.set(MODULE_ID, SETTING_KEY, data);
}

export function uid() {
  return foundry.utils.randomID();
}

/** Whether the given user can see an entry carrying a `visibility` field ("all" | userId[]). */
export function isVisibleTo(entry, user) {
  if (!entry) return false;
  if (user.isGM) return true;
  if (entry.visibility === VISIBILITY_ALL) return true;
  return Array.isArray(entry.visibility) && entry.visibility.includes(user.id);
}

export function newSession(name) {
  return {
    id: uid(),
    name: name || game.i18n.localize("COCAGENCY.Session.NewName"),
    order: Date.now(),
    visibility: VISIBILITY_ALL,
    journalUuid: null,
    sceneUuids: [],
    recap: "",
    revealLog: [],
    handouts: [],
    npcs: []
  };
}

export function newHandout({ title, kind, img = null, pageUuid = null } = {}) {
  return {
    id: uid(),
    title: title || game.i18n.localize("COCAGENCY.Handout.NewName"),
    kind: kind || "image", // "image" | "journal"
    img,
    pageUuid,
    visibility: VISIBILITY_ALL,
    seenBy: []
  };
}

export function newNpcEntry({ actorUuid, note = "" } = {}) {
  return {
    id: uid(),
    actorUuid,
    note,
    visibility: VISIBILITY_ALL,
    seenBy: []
  };
}

export function newSociety(name) {
  return {
    id: uid(),
    name: name || game.i18n.localize("COCAGENCY.Society.NewName"),
    description: "",
    img: null,
    mapImage: null,
    offices: [],
    equipment: [],
    orders: []
  };
}

export function newOffice({ name, location = "", description = "" } = {}) {
  return {
    id: uid(),
    name: name || game.i18n.localize("COCAGENCY.Office.NewName"),
    location,
    description,
    img: null,
    x: null,
    y: null,
    npcUuids: [],
    assignedActorUuids: [],
    visibility: VISIBILITY_ALL
  };
}

export function newEquipmentItem({ name, description = "" } = {}) {
  return {
    id: uid(),
    name: name || game.i18n.localize("COCAGENCY.Equipment.NewName"),
    description,
    img: null
  };
}

export function newOrder({ itemId, itemName, requestedBy, requestedByName } = {}) {
  return {
    id: uid(),
    itemId,
    itemName,
    requestedBy,
    requestedByName,
    requestedAt: Date.now(),
    status: "pending", // "pending" | "approved" | "denied" | "delivered"
    eta: "",
    gmNote: ""
  };
}

export function newRelationship({ fromActorUuid, toActorUuid, label = "" } = {}) {
  return {
    id: uid(),
    fromActorUuid,
    toActorUuid,
    label
  };
}

/** Returns the list of non-GM, non-excluded active player users, plus a static list of all player users. */
export function getPlayerUsers() {
  return game.users.filter((u) => !u.isGM);
}

/**
 * Loads the current data, lets `fn` mutate it in place, then persists it.
 * GM-only: callers must guard with game.user.isGM before invoking.
 */
export async function mutate(fn) {
  const data = getData();
  await fn(data);
  await saveData(data);
  return data;
}

/** Toggles a single player's membership in an entry's visibility, normalizing back to "all" when everyone is included. */
export function toggleVisibilityUser(entry, userId, allPlayerIds) {
  const set = entry.visibility === VISIBILITY_ALL ? new Set(allPlayerIds) : new Set(entry.visibility);
  if (set.has(userId)) set.delete(userId);
  else set.add(userId);
  if (allPlayerIds.length && allPlayerIds.every((id) => set.has(id))) entry.visibility = VISIBILITY_ALL;
  else entry.visibility = Array.from(set);
}

/** Flips an entry between fully visible ("all") and hidden from every player ([]). */
export function toggleVisibilityAll(entry) {
  entry.visibility = entry.visibility === VISIBILITY_ALL ? [] : VISIBILITY_ALL;
}

export function isVisibleToAll(entry) {
  return entry.visibility === VISIBILITY_ALL;
}

export function isVisibleToUser(entry, userId, allPlayerIds) {
  if (entry.visibility === VISIBILITY_ALL) return true;
  return Array.isArray(entry.visibility) && entry.visibility.includes(userId);
}

export function findSession(data, sessionId) {
  return data.sessions.find((s) => s.id === sessionId) ?? null;
}

export function findHandout(data, sessionId, handoutId) {
  return findSession(data, sessionId)?.handouts.find((h) => h.id === handoutId) ?? null;
}

export function findNpc(data, sessionId, npcId) {
  return findSession(data, sessionId)?.npcs.find((n) => n.id === npcId) ?? null;
}

export function findSociety(data, societyId) {
  return data.societies.find((s) => s.id === societyId) ?? null;
}

export function findOffice(data, societyId, officeId) {
  return findSociety(data, societyId)?.offices.find((o) => o.id === officeId) ?? null;
}

export function findEquipmentItem(data, societyId, itemId) {
  return findSociety(data, societyId)?.equipment.find((e) => e.id === itemId) ?? null;
}

export function findOrder(data, societyId, orderId) {
  return findSociety(data, societyId)?.orders.find((o) => o.id === orderId) ?? null;
}

/** Appends a reveal-log entry to a session, keeping only the most recent REVEAL_LOG_LIMIT entries. */
export function pushRevealLogEntry(session, entry) {
  session.revealLog.unshift({ id: uid(), at: Date.now(), ...entry });
  session.revealLog.length = Math.min(session.revealLog.length, REVEAL_LOG_LIMIT);
}

/** Removes an actor from every office's assignedActorUuids across all societies (single active posting). */
export function unassignActorEverywhere(data, actorUuid) {
  for (const society of data.societies) {
    for (const office of society.offices) {
      office.assignedActorUuids = office.assignedActorUuids.filter((u) => u !== actorUuid);
    }
  }
}
