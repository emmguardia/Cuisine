/**
 * Intégrations de paiement — bureau uniquement.
 * GET  /api/admin/integrations                → état (dernière synchro, erreurs)
 * POST /api/admin/integrations/:provider/sync → synchroniser maintenant
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import { integrationsStatus, syncProvider } from '../services/integrations/index.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

// Les API de SumUp et HelloAsso ont leurs propres quotas : 1 synchro manuelle par minute.
const syncLimiter = rateLimit({
  windowMs: 60_000, max: 1, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `sync:${req.params.provider}`,
  message: { error: 'Une synchronisation vient d\'être lancée, réessayez dans une minute' },
});

router.get('/', async (_req, res) => {
  res.json({ integrations: await integrationsStatus() });
});

router.post('/:provider/sync',
  validate({ params: z.object({ provider: z.enum(['sumup', 'helloasso']) }) }),
  syncLimiter,
  async (req, res) => {
    const actor = { id: req.user.id, name: req.user.name, email: req.user.email };
    const result = await syncProvider(req.valid.params.provider, { trigger: 'manuel', actor });
    res.json({ result, integrations: await integrationsStatus() });
  });

export default router;
