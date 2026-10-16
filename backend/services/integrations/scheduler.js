/**
 * Synchronisation périodique, dans le processus du backend (pas de CronJob).
 * Le bail en base garantit un seul passage à la fois même avec plusieurs pods.
 * SYNC_INTERVAL_MINUTES=0 désactive la planification (tests, dev).
 */
import { syncProvider } from './index.js';

export function startScheduler() {
  const minutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 15);
  if (!minutes) return null;

  const tick = async () => {
    for (const name of ['helloasso', 'sumup']) {
      try {
        const r = await syncProvider(name, { trigger: 'auto' });
        if (r.created?.length || r.error) {
          console.log(JSON.stringify({ event: 'sync', provider: name, created: r.created?.length ?? 0, error: r.error ?? null }));
        }
      } catch (err) {
        console.error(`[sync:${name}]`, err.message);
      }
    }
  };

  setTimeout(tick, 60_000).unref();
  const timer = setInterval(tick, minutes * 60_000);
  timer.unref();
  return timer;
}
