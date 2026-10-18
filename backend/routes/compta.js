/**
 * Comptabilité — bureau uniquement.
 * GET  /api/admin/compta/meta                      → catégories, moyens de paiement, exercices
 * GET  /api/admin/compta/summary                   → soldes, résultat de l'exercice, à traiter
 * GET  /api/admin/compta/remboursements?membre=    → avances et remboursements par membre (notes de frais)
 * GET  /api/admin/compta/operations                → liste filtrable
 * POST /api/admin/compta/operations/check          → avertissements avant saisie (doublon, date…)
 * POST /api/admin/compta/operations                → saisir une opération
 * GET  /api/admin/compta/operations/:id            → détail, historique, justificatifs
 * PUT  /api/admin/compta/operations/:id            → corriger sa saisie (auteur, 15 min)
 * POST /api/admin/compta/operations/:id/attachments → joindre un justificatif (corps binaire)
 * GET  /api/admin/compta/attachments/:id           → lire un justificatif
 * POST /api/admin/compta/import?dry_run=1          → importer un lot (connexion récente)
 *
 * Corriger après 15 min, annuler, retirer un justificatif : demandes à double
 * validation (POST /api/admin/requests, types entry.update, entry.cancel,
 * attachment.remove).
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../config/database.js';
import { requireAdmin, requireFreshSession } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../lib/errors.js';
import {
  OperationInput, LotInput, MAX_ATTACHMENT_BYTES, getMeta, getSummary, listOperations, getOperation,
  precheck, createEntry, selfCorrect, addAttachment, getAttachment, importLot, memberDebts,
} from '../services/compta.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email });
const IdParams = z.object({ id: z.uuid() });

router.get('/meta', async (_req, res) => {
  res.json(await getMeta());
});

router.get('/summary', async (_req, res) => {
  res.json(await getSummary());
});

router.get('/operations',
  validate({
    query: z.object({
      from:     z.iso.date().optional(),
      to:       z.iso.date().optional(),
      q:        z.string().trim().max(100).optional(),
      treasury: z.enum(['banque', 'caisse', 'sumup', 'helloasso', 'membre']).optional(),
      category: z.string().max(50).optional(),
      status:   z.enum(['active', 'all']).default('active'),
      limit:    z.coerce.number().int().min(1).max(500).default(200),
      offset:   z.coerce.number().int().min(0).default(0),
    }),
  }),
  async (req, res) => {
    res.json({ operations: await listOperations(req.valid.query) });
  });

router.get('/remboursements',
  validate({ query: z.object({ membre: z.string().trim().min(1).max(255).optional() }) }),
  async (req, res) => {
    res.json({ membres: await memberDebts(req.valid.query) });
  });

router.post('/operations/check', validate({ body: OperationInput }), async (req, res) => {
  res.json({ warnings: await precheck(req.valid.body) });
});

router.post('/operations', validate({ body: OperationInput }), async (req, res) => {
  const created = await withTransaction(conn => createEntry(conn, req.valid.body, actorOf(req), { req }));
  res.status(201).json(await getOperation(created.id));
});

router.get('/operations/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await getOperation(req.valid.params.id));
});

router.put('/operations/:id', validate({ params: IdParams, body: OperationInput }), async (req, res) => {
  await withTransaction(conn => selfCorrect(conn, req.valid.params.id, req.valid.body, actorOf(req), req));
  res.json(await getOperation(req.valid.params.id));
});

/* Justificatif : corps binaire (pas de multipart), type vérifié sur les octets. */
const rawUpload = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  limit: MAX_ATTACHMENT_BYTES,
});

router.post('/operations/:id/attachments',
  rawUpload,
  validate({
    params: IdParams,
    query:  z.object({ filename: z.string().trim().min(1).max(255) }),
  }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw new HttpError(415, 'Envoyez le fichier en corps binaire (JPEG, PNG, WebP ou PDF)');
    }
    const meta = await withTransaction(conn => addAttachment(conn, req.valid.params.id, {
      filename: req.valid.query.filename, buffer: req.body, declaredMime: req.headers['content-type'],
    }, actorOf(req), req));
    res.status(201).json(meta);
  });

router.get('/attachments/:id', validate({ params: IdParams }), async (req, res) => {
  const a = await getAttachment(req.valid.params.id);
  const ascii = a.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  res.set({
    'Content-Type':           a.mime,
    'Content-Length':         a.data.length,
    'Content-Disposition':    `${req.query.download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
    'Cache-Control':          'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    // Rien ne doit pouvoir s'exécuter dans l'origine du site. Les images sont
    // en plus isolées (sandbox) ; pas les PDF, que Chrome refuse alors
    // d'afficher, et dont le lecteur intégré tourne déjà hors de l'origine.
    'Content-Security-Policy': a.mime === 'application/pdf'
      ? "default-src 'none'; object-src 'self'; frame-ancestors 'self'"
      : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'self'",
  });
  res.end(a.data);
});

router.post('/import',
  requireFreshSession(10),
  express.json({ limit: '40mb' }),
  validate({ query: z.object({ dry_run: z.enum(['0', '1']).default('1') }), body: LotInput }),
  async (req, res) => {
    const dryRun = req.valid.query.dry_run === '1';
    const result = await withTransaction(conn => importLot(conn, req.valid.body, actorOf(req), { dryRun, req }));
    res.json(result);
  });

export default router;
