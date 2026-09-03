import { MODULE_ID, VISIBILITY_ALL } from "./data.js";

/** Opens Foundry's image FilePicker and resolves with the chosen path, or undefined if cancelled. */
export function pickImage(current = "") {
  return new Promise((resolve) => {
    const fp = new FilePicker.implementation({ type: "image", current, callback: (path) => resolve(path) });
    const original = fp.close.bind(fp);
    fp.close = (options) => {
      resolve(undefined);
      return original(options);
    };
    fp.browse();
  });
}

/** Parses the drag payload of a sidebar document (Actor, JournalEntry, JournalEntryPage) dropped on an element. */
export function getDroppedDocumentData(event) {
  try {
    return TextEditor.implementation.getDragEventData(event);
  } catch (err) {
    // fall through to manual parsing below
  }
  try {
    return JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch (err) {
    return null;
  }
}

export function resolveActor(actorUuid) {
  if (!actorUuid) return null;
  try {
    return fromUuidSync(actorUuid);
  } catch (err) {
    return null;
  }
}

/** Builds the { title, kind, img, html } payload used to render a handout, either locally or via socket. */
export async function resolveHandoutDisplay(handout) {
  if (handout.kind === "image") {
    return { title: handout.title, kind: "image", img: handout.img, html: null };
  }
  const page = await fromUuid(handout.pageUuid);
  if (!page) return { title: handout.title, kind: "journal", img: null, html: `<p><em>${game.i18n.localize("COCAGENCY.Handout.MissingPage")}</em></p>` };
  if (page.type === "image") {
    return { title: handout.title || page.name, kind: "image", img: page.src, html: null };
  }
  const html = await TextEditor.implementation.enrichHTML(page.text?.content ?? "");
  return { title: handout.title || page.name, kind: "journal", img: null, html };
}

/** Resolves the list of player user ids currently allowed to see a session (GM-executed only). */
export function getSessionAllowedUserIds(session) {
  return session.visibility === VISIBILITY_ALL ? game.users.filter((u) => !u.isGM).map((u) => u.id) : session.visibility;
}

/**
 * Finds or creates the JournalEntry used for a session's player notes, persisting its uuid
 * back onto the session via `mutateSession`. Must run on a client with permission to create
 * journal entries (the GM's client, since a plain Player role may lack that world permission).
 */
export async function getOrCreateSessionJournal(session, mutateSession) {
  let entry = session.journalUuid ? await fromUuid(session.journalUuid) : null;
  if (entry) return entry;

  entry = await JournalEntry.create({
    name: game.i18n.format("COCAGENCY.Session.NotesJournalName", { name: session.name }),
    pages: []
  });
  await mutateSession((s) => {
    s.journalUuid = entry.uuid;
  });
  return entry;
}

/** Grants OWNER on the session's notes journal to every player currently allowed to see that session. */
export async function grantSessionJournalOwnership(entry, session) {
  const ownership = foundry.utils.deepClone(entry.ownership);
  for (const userId of getSessionAllowedUserIds(session)) {
    ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  }
  await entry.update({ ownership });
}

/**
 * Ensures a session has a linked JournalEntry for player notes, granting OWNER
 * to every player who can currently see the session, then opens its sheet.
 */
export async function openSessionNotesJournal(session, mutateSession) {
  const entry = await getOrCreateSessionJournal(session, mutateSession);
  await grantSessionJournalOwnership(entry, session);
  entry.sheet.render(true);
}

/**
 * Finds or creates a private JournalEntryPage for `forUser`'s personal notes on a given NPC,
 * inside the session's notes journal. The page's ownership is restricted to that single player
 * (plus the GM), even though the parent entry is shared/owned by every player with session access.
 * Must run on a client with permission to create journal entries (see getOrCreateSessionJournal).
 */
export async function ensureNpcNotePage(session, npc, forUser, mutateSession) {
  const entry = await getOrCreateSessionJournal(session, mutateSession);
  await grantSessionJournalOwnership(entry, session);

  let page = entry.pages.find(
    (p) => p.getFlag(MODULE_ID, "npcId") === npc.id && p.getFlag(MODULE_ID, "ownerUserId") === forUser.id
  );
  if (page) return page;

  const actor = resolveActor(npc.actorUuid);
  const created = await entry.createEmbeddedDocuments("JournalEntryPage", [
    {
      name: game.i18n.format("COCAGENCY.Npc.NotePageName", { npc: actor?.name ?? "?", user: forUser.name }),
      type: "text",
      text: { content: "" },
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [forUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      flags: { [MODULE_ID]: { npcId: npc.id, ownerUserId: forUser.id } }
    }
  ]);
  return created[0];
}
