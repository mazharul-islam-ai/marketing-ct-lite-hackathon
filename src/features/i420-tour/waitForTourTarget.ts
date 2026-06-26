export function tourSelector(id: string): string {
  return `[data-tour="${id}"]`;
}

export async function waitForTourTarget(
  tourId: string,
  options?: { timeout?: number; interval?: number },
): Promise<Element> {
  const timeout = options?.timeout ?? 8000;
  const interval = options?.interval ?? 100;
  const selector = tourSelector(tourId);
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start >= timeout) {
        reject(new Error(`Tour target not found: ${tourId}`));
        return;
      }
      window.setTimeout(tick, interval);
    };
    tick();
  });
}
