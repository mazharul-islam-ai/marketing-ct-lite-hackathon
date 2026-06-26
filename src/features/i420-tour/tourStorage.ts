export const TOUR_VERSION = "v2";

export function tourCompletedKey(userId: string): string {
  return `i420-tour-completed-${TOUR_VERSION}:${userId}`;
}

export function isTourCompleted(userId: string | undefined): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(tourCompletedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(tourCompletedKey(userId), "1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearTourCompleted(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(tourCompletedKey(userId));
  } catch {
    // ignore
  }
}
