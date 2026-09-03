import { MODULE_ID, SETTING_KEY, registerSettings } from "./data.js";
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

// World settings are replicated to every connected client; use that to refresh any open
// Agency window live instead of requiring players to reload the page to see GM changes.
const SETTING_FULL_KEY = `${MODULE_ID}.${SETTING_KEY}`;
Hooks.on("updateSetting", (setting) => {
  if (setting.key !== SETTING_FULL_KEY) return;
  AgencyApp.refreshOpen();
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
