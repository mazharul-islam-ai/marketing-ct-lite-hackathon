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

export type I420CanvasViewMode = "card" | "flow" | "compare";

export const I420_TOUR_OPEN_SETTINGS_TAB = "i420-tour:open-settings-tab";
export const I420_TOUR_OPEN_STUDIO_TAB = "i420-tour:open-studio-tab";
export const I420_TOUR_SET_CANVAS_VIEW = "i420-tour:set-canvas-view";
export const I420_TOUR_OPEN_PUBLISH_MODAL = "i420-tour:open-publish-modal";
export const I420_TOUR_CLOSE_PUBLISH_MODAL = "i420-tour:close-publish-modal";
export const I420_TOUR_SELECT_FIRST_NODE = "i420-tour:select-first-node";
export const I420_TOUR_DESELECT_NODE = "i420-tour:deselect-node";
export const I420_TOUR_OPEN_CARD_EDIT = "i420-tour:open-card-edit";
export const I420_TOUR_CLOSE_CARD_EDIT = "i420-tour:close-card-edit";
export const I420_TOUR_EXPAND_CHAT_PANEL = "i420-tour:expand-chat-panel";

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

export function dispatchCanvasView(mode: I420CanvasViewMode): void {
  window.dispatchEvent(
    new CustomEvent(I420_TOUR_SET_CANVAS_VIEW, { detail: { mode } }),
  );
}

export function dispatchOpenPublishModal(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_OPEN_PUBLISH_MODAL));
}

export function dispatchClosePublishModal(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_CLOSE_PUBLISH_MODAL));
}

export function dispatchSelectFirstNode(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_SELECT_FIRST_NODE));
}

export function dispatchDeselectNode(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_DESELECT_NODE));
}

export function dispatchOpenCardEdit(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_OPEN_CARD_EDIT));
}

export function dispatchCloseCardEdit(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_CLOSE_CARD_EDIT));
}

export function dispatchExpandChatPanel(): void {
  window.dispatchEvent(new CustomEvent(I420_TOUR_EXPAND_CHAT_PANEL));
}

export function dispatchTourCleanup(): void {
  dispatchOpenStudioTab("design");
  dispatchCanvasView("card");
  dispatchDeselectNode();
  dispatchCloseCardEdit();
  dispatchClosePublishModal();
}
