import {
  SOCKET_NAME,
  VISIBILITY_ALL,
  getData,
  mutate,
  findSession,
  findNpc,
  findHandout,
  findSociety,
  findEquipmentItem,
  newOrder
} from "./data.js";
import { ensureNpcNotePage } from "./helpers.js";
import { HandoutLightboxApp } from "./apps/lightbox-app.js";

/**
 * Broadcasts a request to open a handout on the clients of the given users.
 * The GM's own client is handled locally by the caller (sockets don't echo to sender).
 */
export function pushHandoutToPlayers(handout, targetUserIds) {
  game.socket.emit(SOCKET_NAME, {
    action: "showHandout",
    payload: { handout, targetUserIds }
  });
}

/**
 * Asks a connected GM's client to create (or find) the requesting player's private note page
 * for a given NPC. Journal entry/page creation requires GM-level permission, which a Player
 * role may not have, so the actual work always runs on a GM client via this relay.
 */
export function requestNpcNotePage(sessionId, npcId) {
  game.socket.emit(SOCKET_NAME, {
    action: "requestNpcNote",
    payload: { sessionId, npcId, requesterId: game.user.id }
  });
}

function notifyNpcNoteReady(pageUuid, targetUserId) {
  game.socket.emit(SOCKET_NAME, {
    action: "npcNoteReady",
    payload: { pageUuid, targetUserId }
  });
}

/** Tells a connected GM's client to record that the current user has seen the given items. */
export function markItemsSeen(sessionId, handoutIds, npcIds) {
  if (!handoutIds.length && !npcIds.length) return;
  game.socket.emit(SOCKET_NAME, {
    action: "markSeen",
    payload: { sessionId, handoutIds, npcIds, requesterId: game.user.id }
  });
}

/** Asks a connected GM's client to log an equipment order on behalf of the current player. */
export function requestEquipmentOrder(societyId, itemId) {
  game.socket.emit(SOCKET_NAME, {
    action: "requestEquipmentOrder",
    payload: { societyId, itemId, requesterId: game.user.id }
  });
}

export function registerSocketListener() {
  game.socket.on(SOCKET_NAME, async ({ action, payload } = {}) => {
    if (action === "showHandout") {
      const { handout, targetUserIds } = payload ?? {};
      if (!handout) return;
      const allowed = targetUserIds === VISIBILITY_ALL || targetUserIds?.includes(game.user.id);
      if (!allowed) return;
      new HandoutLightboxApp(handout).render(true);
    } else if (action === "requestNpcNote") {
      if (!game.user.isGM) return;
      const { sessionId, npcId, requesterId } = payload ?? {};
      const requester = game.users.get(requesterId);
      if (!requester) return;
      const session = findSession(getData(), sessionId);
      const npc = findNpc(getData(), sessionId, npcId);
      if (!session || !npc) return;
      const page = await ensureNpcNotePage(session, npc, requester, (fn) =>
        mutate((d) => fn(findSession(d, sessionId)))
      );
      notifyNpcNoteReady(page.uuid, requesterId);
    } else if (action === "npcNoteReady") {
      const { pageUuid, targetUserId } = payload ?? {};
      if (targetUserId !== game.user.id) return;
      // The document-creation broadcast usually beats this custom message, but retry once in
      // case this client's local cache hasn't caught up yet.
      let page = await fromUuid(pageUuid);
      if (!page) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        page = await fromUuid(pageUuid);
      }
      page?.sheet.render(true);
    } else if (action === "markSeen") {
      if (!game.user.isGM) return;
      const { sessionId, handoutIds, npcIds, requesterId } = payload ?? {};
      await mutate((data) => {
        const session = findSession(data, sessionId);
        if (!session) return;
        for (const id of handoutIds ?? []) {
          const handout = findHandout(data, sessionId, id);
          if (handout && !handout.seenBy.includes(requesterId)) handout.seenBy.push(requesterId);
        }
        for (const id of npcIds ?? []) {
          const npc = findNpc(data, sessionId, id);
          if (npc && !npc.seenBy.includes(requesterId)) npc.seenBy.push(requesterId);
        }
      });
    } else if (action === "requestEquipmentOrder") {
      if (!game.user.isGM) return;
      const { societyId, itemId, requesterId } = payload ?? {};
      const requester = game.users.get(requesterId);
      const item = findEquipmentItem(getData(), societyId, itemId);
      if (!requester || !item) return;
      await mutate((data) => {
        const society = findSociety(data, societyId);
        society?.orders.push(
          newOrder({ itemId: item.id, itemName: item.name, requestedBy: requester.id, requestedByName: requester.name })
        );
      });
    }
  });
}
