export const I420_ROUTES = {
  root: "/i420",
  new: "/i420/new",
  settings: "/i420/settings",
  automations: "/i420/automations",
  automationLogs: "/i420/automations/logs",
  agent: (id: string) => `/i420/${id}`,
} as const;

/** True for full-screen studio editor routes (no layout chrome). */
export function isI420StudioEditorPath(pathname: string): boolean {
  if (pathname === I420_ROUTES.new) return true;
  if (pathname === I420_ROUTES.root) return false;
  if (pathname.startsWith(`${I420_ROUTES.root}/settings`)) return false;
  if (pathname.startsWith(`${I420_ROUTES.root}/automations`)) return false;
  return pathname.startsWith(`${I420_ROUTES.root}/`);
}

/** Map legacy adminpanel paths to i420 routes. */
export function legacyAgentBuilderPathToI420(pathname: string): string {
  const rest = pathname.replace(/^\/adminpanel\/agent-builder/, "");
  return `${I420_ROUTES.root}${rest || ""}`;
}

export function legacyAutomationsPathToI420(pathname: string): string {
  const rest = pathname.replace(/^\/adminpanel\/automations/, "/automations");
  return `${I420_ROUTES.root}${rest || "/automations"}`;
}
