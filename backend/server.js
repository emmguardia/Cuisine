import 'dotenv/config';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth.js';
import { applySecurityMiddleware } from './config/security.js';
import recipesRouter from './routes/recipes.js';
import adminRouter  from './routes/admin.js';
import uploadRouter from './routes/upload.js';
import teamRouter   from './routes/team.js';

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Sécurité ────────────────────────────────────────────────────── */
applySecurityMiddleware(app);

/* ── Better Auth — doit être AVANT express.json() ───────────────── */
app.all('/api/auth{/*path}', toNodeHandler(auth));

/* ── Body parser ─────────────────────────────────────────────────── */
app.use(express.json({ limit: '512kb' }));

/* ── Health check ─────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cuisine-backend' });
});

/* ── Routes métier ───────────────────────────────────────────────── */
app.use('/api/recipes', recipesRouter);
app.use('/api/admin',   adminRouter);
app.use('/api/upload',  uploadRouter);
app.use('/api/team',    teamRouter);

/* ── 404 ─────────────────────────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

/* ── Erreur globale ──────────────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

/* ── Démarrage ───────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[cuisine-backend] :${PORT} — NODE_ENV=${process.env.NODE_ENV || 'development'}`);
});
