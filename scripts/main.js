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

// Foundry v14 passes `controls` as a Record<string, SceneControl>, and each group's `tools`
// is itself a Record<string, SceneControlTool> (not an array). `order` is a required field.
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens;
  if (!tokenControls) return;

  tokenControls.tools[MODULE_ID] = {
    name: MODULE_ID,
    title: "COCAGENCY.App.Title",
    icon: "fa-solid fa-user-secret",
    button: true,
    visible: true,
    order: Object.keys(tokenControls.tools).length,
    onChange: () => new AgencyApp().render(true)
  };
});
