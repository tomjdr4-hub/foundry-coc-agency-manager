import { VISIBILITY_ALL } from "./data.js";

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

/**
 * Ensures a session has a linked JournalEntry for player notes, granting OWNER
 * to every player who can currently see the session, then opens its sheet.
 */
export async function openSessionNotesJournal(session, mutateSession) {
  let entry = session.journalUuid ? await fromUuid(session.journalUuid) : null;

  if (!entry) {
    entry = await JournalEntry.create({
      name: game.i18n.format("COCAGENCY.Session.NotesJournalName", { name: session.name }),
      pages: []
    });
    await mutateSession((s) => {
      s.journalUuid = entry.uuid;
    });
  }

  const ownership = foundry.utils.deepClone(entry.ownership);
  const allowedIds =
    session.visibility === VISIBILITY_ALL ? game.users.filter((u) => !u.isGM).map((u) => u.id) : session.visibility;
  for (const userId of allowedIds) ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  await entry.update({ ownership });

  entry.sheet.render(true);
}
