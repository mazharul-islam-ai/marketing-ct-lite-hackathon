export type I420SettingsTourTab =
  | "models"
  | "tools"
  | "mcp"
  | "data"
  | "system_prompt"
  | "costs";

export type I420StudioTourTab =
  | "design"
  | "runtime"
  | "json"
  | "logs"
  | "versions";

export const I420_TOUR_OPEN_SETTINGS_TAB = "i420-tour:open-settings-tab";
export const I420_TOUR_OPEN_STUDIO_TAB = "i420-tour:open-studio-tab";

export function dispatchOpenSettingsTab(tab: I420SettingsTourTab): void {
  window.dispatchEvent(
    new CustomEvent(I420_TOUR_OPEN_SETTINGS_TAB, { detail: { tab } }),
  );
}

export function dispatchOpenStudioTab(tab: I420StudioTourTab): void {
  window.dispatchEvent(
    new CustomEvent(I420_TOUR_OPEN_STUDIO_TAB, { detail: { tab } }),
  );
}
