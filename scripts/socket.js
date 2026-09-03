import { SOCKET_NAME, VISIBILITY_ALL } from "./data.js";
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

export function registerSocketListener() {
  game.socket.on(SOCKET_NAME, ({ action, payload } = {}) => {
    if (action === "showHandout") {
      const { handout, targetUserIds } = payload ?? {};
      if (!handout) return;
      const allowed = targetUserIds === VISIBILITY_ALL || targetUserIds?.includes(game.user.id);
      if (!allowed) return;
      new HandoutLightboxApp(handout).render(true);
    }
  });
}
