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
  const tool = {
    name: MODULE_ID,
    title: "COCAGENCY.App.Title",
    icon: "fa-solid fa-user-secret",
    button: true,
    onClick: () => new AgencyApp().render(true),
    onChange: () => new AgencyApp().render(true)
  };

  // Foundry v13 passes controls as a keyed object, v12 and earlier as an array.
  if (Array.isArray(controls)) {
    const tokenControls = controls.find((c) => c.name === "token");
    tokenControls?.tools.push(tool);
  } else if (controls?.tokens) {
    controls.tokens.tools[tool.name] = tool;
  }
});
