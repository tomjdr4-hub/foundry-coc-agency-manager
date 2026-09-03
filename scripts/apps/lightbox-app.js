import { MODULE_ID } from "../data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Read-only popout shown to a targeted set of players when the GM "reveals" a handout.
 * Accepts a pre-resolved payload: { title, kind: "image"|"journal", img, html }.
 */
export class HandoutLightboxApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "coc-agency-lightbox-{id}",
    window: {
      title: "COCAGENCY.Lightbox.Title",
      icon: "fa-solid fa-image",
      contentClasses: ["coc-agency-lightbox"],
      resizable: true
    },
    position: { width: 720, height: "auto" }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/lightbox.hbs` }
  };

  #payload;

  constructor(payload, options = {}) {
    super(options);
    this.#payload = payload;
  }

  get title() {
    return this.#payload.title || game.i18n.localize("COCAGENCY.Lightbox.Title");
  }

  async _prepareContext() {
    return { ...this.#payload };
  }
}
