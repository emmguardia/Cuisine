/**
 * Événements et rentabilité — bureau uniquement.
 * GET    /api/admin/evenements                       → liste avec recettes, dépenses, résultat
 * POST   /api/admin/evenements                       → créer
 * GET    /api/admin/evenements/:id                   → détail et opérations rattachées
 * PUT    /api/admin/evenements/:id                   → modifier
 * DELETE /api/admin/evenements/:id                   → supprimer (les opérations restent en compta)
 * POST   /api/admin/evenements/:id/operations        → rattacher une opération
 * DELETE /api/admin/evenements/:id/operations/:originId → détacher
 */
import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import {
  EventInput, LinkInput, listEvents, getEvent, createEvent, updateEvent, deleteEvent, linkEntry, unlinkEntry,
} from '../services/events.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email });
const IdParams = z.object({ id: z.uuid() });

router.get('/', async (_req, res) => {
  res.json({ events: await listEvents() });
});

router.post('/', validate({ body: EventInput }), async (req, res) => {
  const id = await withTransaction(conn => createEvent(conn, req.valid.body, actorOf(req), { req }));
  res.status(201).json(await getEvent(id));
});

router.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await getEvent(req.valid.params.id));
});

router.put('/:id', validate({ params: IdParams, body: EventInput }), async (req, res) => {
  await withTransaction(conn => updateEvent(conn, req.valid.params.id, req.valid.body, actorOf(req), req));
  res.json(await getEvent(req.valid.params.id));
});

router.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await withTransaction(conn => deleteEvent(conn, req.valid.params.id, actorOf(req), req));
  res.json({ message: 'Événement supprimé' });
});

router.post('/:id/operations', validate({ params: IdParams, body: LinkInput }), async (req, res) => {
  await withTransaction(conn => linkEntry(conn, req.valid.params.id, req.valid.body, actorOf(req), req));
  res.status(201).json(await getEvent(req.valid.params.id));
});

router.delete('/:id/operations/:originId',
  validate({ params: z.object({ id: z.uuid(), originId: z.uuid() }) }),
  async (req, res) => {
    await withTransaction(conn => unlinkEntry(conn, req.valid.params.id, req.valid.params.originId, actorOf(req), req));
    res.json(await getEvent(req.valid.params.id));
  });

export default router;
