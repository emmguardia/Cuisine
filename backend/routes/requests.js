/**
 * Demandes à double validation — bureau uniquement.
 * GET  /api/admin/requests?status=pending   → liste (pending par défaut, ou all)
 * GET  /api/admin/requests/summary          → nombre à valider / mes demandes
 * GET  /api/admin/requests/:id              → détail
 * POST /api/admin/requests                  → créer une demande
 * POST /api/admin/requests/:id/approve      → approuver et appliquer (connexion récente)
 * POST /api/admin/requests/:id/reject       → refuser
 * POST /api/admin/requests/:id/cancel       → l'auteur retire sa demande
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireFreshSession } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import {
  listRequests, getRequest, createRequest, approveRequest,
  rejectRequest, cancelRequest, countPendingFor,
} from '../services/changeRequests.js';
import '../services/handlers/index.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email });

const IdParams  = z.object({ id: z.uuid() });
const Decision  = z.object({ comment: z.string().trim().max(1000).optional() }).strict();
const STATUSES  = ['pending', 'approved', 'rejected', 'cancelled', 'expired', 'obsolete', 'all'];

router.get('/',
  validate({ query: z.object({ status: z.enum(STATUSES).default('pending') }) }),
  async (req, res) => {
    res.json({ requests: await listRequests({ status: req.valid.query.status }) });
  });

router.get('/summary', async (req, res) => {
  res.json(await countPendingFor(req.user.id));
});

router.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await getRequest(req.valid.params.id));
});

router.post('/',
  validate({
    body: z.object({
      type:      z.string().min(1).max(64),
      target_id: z.string().trim().min(1).max(255).nullable().optional(),
      payload:   z.record(z.string(), z.unknown()).default({}),
      reason:    z.string().trim().min(5, 'Motif obligatoire (5 caractères minimum)').max(1000),
    }).strict(),
  }),
  async (req, res) => {
    const { type, target_id, payload, reason } = req.valid.body;
    const request = await createRequest({
      type, targetId: target_id ?? null, payload, reason, actor: actorOf(req), req,
    });
    res.status(201).json(request);
  });

router.post('/:id/approve',
  requireFreshSession(10),
  validate({ params: IdParams, body: Decision }),
  async (req, res) => {
    res.json(await approveRequest({
      id: req.valid.params.id, actor: actorOf(req), comment: req.valid.body.comment ?? null, req,
    }));
  });

router.post('/:id/reject',
  validate({ params: IdParams, body: Decision }),
  async (req, res) => {
    res.json(await rejectRequest({
      id: req.valid.params.id, actor: actorOf(req), comment: req.valid.body.comment ?? null, req,
    }));
  });

router.post('/:id/cancel',
  validate({ params: IdParams }),
  async (req, res) => {
    res.json(await cancelRequest({ id: req.valid.params.id, actor: actorOf(req), req }));
  });

export default router;
