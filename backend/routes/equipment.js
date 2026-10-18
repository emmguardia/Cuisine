/**
 * Matériel et inventaires — bureau uniquement.
 * GET  /api/admin/materiel                         → liste (+ résumé)
 * POST /api/admin/materiel                         → créer une fiche
 * GET  /api/admin/materiel/:id                     → fiche, mouvements
 * PUT  /api/admin/materiel/:id                     → modifier les informations (pas la quantité)
 * POST /api/admin/materiel/:id/photo               → photo (corps binaire)
 * GET  /api/admin/materiel/:id/photo               → lire la photo
 * GET  /api/admin/materiel/inventaires             → contrôles
 * POST /api/admin/materiel/inventaires             → démarrer un contrôle
 * GET  /api/admin/materiel/inventaires/:id         → lignes du contrôle
 * PUT  /api/admin/materiel/inventaires/:id/lignes/:equipmentId → quantité comptée, décision
 * POST /api/admin/materiel/inventaires/:id/valider → appliquer les écarts
 * POST /api/admin/materiel/inventaires/:id/abandonner
 *
 * Changer une quantité hors inventaire, sortir une fiche : demandes à double
 * validation (types equipment.adjust, equipment.retire).
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../lib/errors.js';
import {
  CATEGORIES, CONDITIONS, MOVE_KINDS, MAX_PHOTO_BYTES, EquipmentInput, NewEquipmentInput,
  listEquipment, equipmentSummary, getEquipment, createEquipment, updateEquipment, setPhoto, getPhoto,
  listChecks, startCheck, getCheck, setCheckLine, validateCheck, abandonCheck,
} from '../services/equipment.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email });
const IdParams = z.object({ id: z.uuid() });

router.get('/',
  validate({ query: z.object({
    status: z.enum(['actif', 'sorti', 'all']).default('actif'),
    category: z.enum(Object.keys(CATEGORIES)).optional(),
    q: z.string().trim().max(100).optional(),
  }) }),
  async (req, res) => {
    res.json({
      items: await listEquipment(req.valid.query), summary: await equipmentSummary(),
      categories: CATEGORIES, conditions: CONDITIONS, kinds: MOVE_KINDS,
    });
  });

router.post('/', validate({ body: NewEquipmentInput }), async (req, res) => {
  const id = await withTransaction(conn => createEquipment(conn, req.valid.body, actorOf(req), req));
  res.status(201).json(await getEquipment(id));
});

/* Inventaires (avant /:id pour ne pas être capturés comme identifiant) */
router.get('/inventaires', async (_req, res) => {
  res.json({ checks: await listChecks() });
});

router.post('/inventaires',
  validate({ body: z.object({ date: z.iso.date() }).strict() }),
  async (req, res) => {
    const id = await withTransaction(conn => startCheck(conn, req.valid.body.date, actorOf(req), req));
    res.status(201).json(await getCheck(id));
  });

router.get('/inventaires/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await getCheck(req.valid.params.id));
});

router.put('/inventaires/:id/lignes/:equipmentId',
  validate({
    params: z.object({ id: z.uuid(), equipmentId: z.uuid() }),
    body: z.object({
      counted_qty: z.number().int().min(0).max(10_000),
      resolution: z.enum(['perdu', 'casse', 'retrouve', 'a_recompter']).nullish(),
    }).strict(),
  }),
  async (req, res) => {
    const { id, equipmentId } = req.valid.params;
    await withTransaction(conn => setCheckLine(conn, id, equipmentId, req.valid.body, actorOf(req)));
    res.json({ ok: true });
  });

router.post('/inventaires/:id/valider', validate({ params: IdParams }), async (req, res) => {
  const ecarts = await withTransaction(conn => validateCheck(conn, req.valid.params.id, actorOf(req), req));
  res.json({ ecarts, check: await getCheck(req.valid.params.id) });
});

router.post('/inventaires/:id/abandonner', validate({ params: IdParams }), async (req, res) => {
  await withTransaction(conn => abandonCheck(conn, req.valid.params.id, actorOf(req), req));
  res.json({ ok: true });
});

/* Fiches */
router.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await getEquipment(req.valid.params.id));
});

router.put('/:id', validate({ params: IdParams, body: EquipmentInput }), async (req, res) => {
  await withTransaction(conn => updateEquipment(conn, req.valid.params.id, req.valid.body, actorOf(req), req));
  res.json(await getEquipment(req.valid.params.id));
});

router.post('/:id/photo',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PHOTO_BYTES }),
  validate({ params: IdParams }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(415, 'Envoyez la photo en JPEG, PNG ou WebP');
    await withTransaction(conn => setPhoto(conn, req.valid.params.id, req.body, req.headers['content-type'], actorOf(req), req));
    res.status(201).json({ ok: true });
  });

router.get('/:id/photo', validate({ params: IdParams }), async (req, res) => {
  const p = await getPhoto(req.valid.params.id);
  res.set({
    'Content-Type': p.mime, 'Content-Length': p.data.length, 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox; frame-ancestors 'self'",
  });
  res.end(p.data);
});

export default router;
