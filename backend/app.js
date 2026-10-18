import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth.js';
import { applySecurityMiddleware } from './config/security.js';
import { errorHandler } from './lib/errors.js';
import recipesRouter  from './routes/recipes.js';
import adminRouter    from './routes/admin.js';
import requestsRouter from './routes/requests.js';
import auditRouter    from './routes/audit.js';
import uploadRouter   from './routes/upload.js';
import teamRouter     from './routes/team.js';
import comptaRouter   from './routes/compta.js';
import membersRouter  from './routes/members.js';
import eventsRouter   from './routes/events.js';
import integrationsRouter from './routes/integrations.js';
import equipmentRouter from './routes/equipment.js';
import webhooksRouter from './routes/webhooks.js';

/**
 * Table de montage des routes métier. Exportée pour le test d'autorisation,
 * qui vérifie chaque route qu'elle contient : toute nouvelle route doit être
 * montée ici.
 */
export const ROUTES = [
  { path: '/api/recipes',        router: recipesRouter },
  { path: '/api/admin/requests', router: requestsRouter },
  { path: '/api/admin/audit',    router: auditRouter },
  { path: '/api/admin/compta',   router: comptaRouter },
  { path: '/api/admin/membres',  router: membersRouter },
  { path: '/api/admin/evenements', router: eventsRouter },
  { path: '/api/admin/integrations', router: integrationsRouter },
  { path: '/api/admin/materiel', router: equipmentRouter },
  { path: '/api/admin',          router: adminRouter },
  { path: '/api/upload',         router: uploadRouter },
  { path: '/api/team',           router: teamRouter },
];

export const LOT_IMPORT_PATH = '/api/admin/compta/import';

export function createApp() {
  const app = express();

  /* ── Sécurité ────────────────────────────────────────────────────── */
  applySecurityMiddleware(app);

  /* ── Better Auth — doit être AVANT express.json() ───────────────── */
  app.all('/api/auth{/*path}', toNodeHandler(auth));

  /* ── Body parser ─────────────────────────────────────────────────── */
  // L'import de lot (avec justificatifs) a son propre parseur, plus large,
  // monté APRÈS l'authentification dans routes/compta.js.
  app.use(express.json({
    limit: '512kb',
    type: (req) => req.is('application/json') && !req.originalUrl.startsWith(LOT_IMPORT_PATH),
  }));

  /* ── Health check ─────────────────────────────────────────────────── */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'cuisine-backend' });
  });

  /* ── Notifications entrantes (protégées par jeton, voir routes/webhooks.js) ── */
  app.use('/api/webhooks', webhooksRouter);

  /* ── Routes métier ───────────────────────────────────────────────── */
  for (const { path, router } of ROUTES) app.use(path, router);

  /* ── 404 ─────────────────────────────────────────────────────────── */
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
  });

  /* ── Erreur globale ──────────────────────────────────────────────── */
  app.use(errorHandler);

  return app;
}
