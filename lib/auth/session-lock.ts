export const SESSION_LOCK_PREFIX = "hyrule-guessr.session:";
const ACQUIRE_ATTEMPTS = 8;

export function sessionLockName(sessionId: string) {
  return `${SESSION_LOCK_PREFIX}${sessionId}`;
}

export async function requestExclusiveSessionLock(
  sessionId: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (!navigator.locks) return true;

  for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS; attempt++) {
    if (signal.aborted) return true;

    const acquired = await tryAcquire(sessionId, signal);
    if (acquired) return true;

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return false;
}

function tryAcquire(sessionId: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    void navigator.locks.request(
      sessionLockName(sessionId),
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }

        resolve(true);

        await new Promise<void>((release) => {
          if (signal.aborted) {
            release();
            return;
          }
          signal.addEventListener("abort", () => release(), { once: true });
        });
      },
    );
  });
}
