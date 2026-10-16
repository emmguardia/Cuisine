/**
 * Notifications HelloAsso : POST /api/webhooks/helloasso/:token
 *
 * Le contenu reçu n'est jamais utilisé : la notification déclenche seulement
 * une synchronisation, qui relit tout via l'API authentifiée. Un faux appel ne
 * peut donc rien créer. Le jeton (256 bits) est comparé en temps constant ;
 * un jeton faux reçoit la même 404 qu'une route inexistante.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual, createHash } from 'crypto';
import { syncProvider } from '../services/integrations/index.js';

const router = Router();

router.use(rateLimit({
  windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
  message: { error: 'Trop de requêtes' },
}));

const digest = (v) => createHash('sha256').update(String(v)).digest();

function tokenMatches(given) {
  const expected = process.env.HELLOASSO_WEBHOOK_TOKEN;
  if (!expected || expected.length < 32) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

let pending = null;

router.post('/helloasso/:token', (req, res) => {
  if (!tokenMatches(req.params.token)) return res.status(404).json({ error: 'Route introuvable' });
  res.status(202).json({ received: true });
  // Plusieurs notifications rapprochées ne déclenchent qu'une synchronisation.
  if (!pending) {
    pending = setTimeout(() => {
      pending = null;
      syncProvider('helloasso', { trigger: 'webhook' })
        .catch(err => console.error('[webhook:helloasso]', err.message));
    }, 5_000);
    pending.unref?.();
  }
});

export default router;
