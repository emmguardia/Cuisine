/* Point d'entrée des synchronisations (CronJob, bouton admin, webhook). */
import { runExclusive, loadState } from './runner.js';
import { sumupApi, syncSumup } from './sumup.js';
import { helloassoApi, syncHelloasso } from './helloasso.js';

export const PROVIDERS = {
  sumup: {
    label: 'SumUp',
    configured: () => !!(process.env.SUMUP_API_KEY && process.env.SUMUP_MERCHANT_CODE),
    run: (ctx) => syncSumup(ctx, {
      api: sumupApi({ apiKey: process.env.SUMUP_API_KEY, merchantCode: process.env.SUMUP_MERCHANT_CODE }),
    }),
  },
  helloasso: {
    label: 'HelloAsso',
    configured: () => !!(process.env.HELLOASSO_CLIENT_ID && process.env.HELLOASSO_CLIENT_SECRET && process.env.HELLOASSO_ORG_SLUG),
    run: (ctx) => syncHelloasso(ctx, {
      api: helloassoApi({
        clientId: process.env.HELLOASSO_CLIENT_ID,
        clientSecret: process.env.HELLOASSO_CLIENT_SECRET,
        orgSlug: process.env.HELLOASSO_ORG_SLUG,
      }),
    }),
  },
};

export async function syncProvider(name, { trigger = 'cron', actor = null } = {}) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Intégration inconnue : ${name}`);
  if (!p.configured()) return { error: 'Clés API absentes' };
  return runExclusive(name, (ctx) => p.run(ctx), { trigger, actor });
}

export async function integrationsStatus() {
  const out = [];
  for (const [name, p] of Object.entries(PROVIDERS)) {
    const s = await loadState(name);
    out.push({
      provider: name, label: p.label, configured: p.configured(),
      running: !!(s.lease_until && new Date(s.lease_until) > new Date()),
      last_run_at: s.last_run_at, last_success_at: s.last_success_at,
      last_error: s.last_error, last_error_at: s.last_error_at,
      last_created: s.last_result?.created ?? [], cursor: s.cursor,
    });
  }
  return out;
}
