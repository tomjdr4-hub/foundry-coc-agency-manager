import { MODULE_ID, registerSettings } from "./data.js";
import { AgencyApp } from "./apps/agency-app.js";
import { registerSocketListener } from "./socket.js";

Hooks.once("init", () => {
  registerSettings();

  game.modules.get(MODULE_ID).api = {
    open: () => new AgencyApp().render(true)
  };
});

Hooks.once("ready", () => {
  registerSocketListener();
});

Hooks.on("getSceneControlButtons", (controls) => {
  // Foundry v13 passes controls as a keyed object with tools as a Record, v12 and earlier as arrays.
  if (Array.isArray(controls)) {
    const tokenControls = controls.find((c) => c.name === "token");
    if (!tokenControls) return;
    tokenControls.tools.push({
      name: MODULE_ID,
      title: "COCAGENCY.App.Title",
      icon: "fa-solid fa-user-secret",
      button: true,
      onClick: () => new AgencyApp().render(true)
    });
  } else if (controls?.tokens) {
    controls.tokens.tools[MODULE_ID] = {
      name: MODULE_ID,
      title: "COCAGENCY.App.Title",
      icon: "fa-solid fa-user-secret",
      button: true,
      visible: true,
      order: Object.keys(controls.tokens.tools).length,
      onChange: () => new AgencyApp().render(true)
    };
  }
});
