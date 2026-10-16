/**
 * Adhérents — bureau uniquement (données personnelles).
 * GET    /api/admin/membres?season=2026-2027&q=  → liste
 * POST   /api/admin/membres                      → ajouter
 * PUT    /api/admin/membres/:id                  → modifier
 * DELETE /api/admin/membres/:id                  → supprimer (droit à l'effacement)
 * PATCH  /api/admin/membres/:id/mail-guardia     → renseigner le mail @guardiaschool.fr
 * POST   /api/admin/membres/:id/equipe           → ajouter à l'équipe (/equipe)
 */
import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import {
  MemberInput, SchoolEmail, listMembers, createMember, updateMember, deleteMember, setSchoolEmail, addToTeam,
} from '../services/members.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, email: req.user.email });
const IdParams = z.object({ id: z.uuid() });

router.get('/',
  validate({ query: z.object({ season: z.string().max(20).optional(), q: z.string().trim().max(100).optional() }) }),
  async (req, res) => {
    res.json(await listMembers(req.valid.query));
  });

router.post('/', validate({ body: MemberInput }), async (req, res) => {
  const id = await withTransaction(conn => createMember(conn, req.valid.body, actorOf(req), { req }));
  res.status(201).json({ id });
});

router.put('/:id', validate({ params: IdParams, body: MemberInput }), async (req, res) => {
  await withTransaction(conn => updateMember(conn, req.valid.params.id, req.valid.body, actorOf(req), req));
  res.json({ message: 'Adhérent mis à jour' });
});

router.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await withTransaction(conn => deleteMember(conn, req.valid.params.id, actorOf(req), req));
  res.json({ message: 'Adhérent supprimé' });
});

router.patch('/:id/mail-guardia',
  validate({ params: IdParams, body: z.object({ school_email: SchoolEmail }).strict() }),
  async (req, res) => {
    await withTransaction(conn => setSchoolEmail(conn, req.valid.params.id, req.valid.body.school_email ?? null, actorOf(req), req));
    res.json({ message: 'Mail Guardia enregistré' });
  });

router.post('/:id/equipe',
  validate({ params: IdParams, body: z.object({ role: z.string().trim().max(255).optional() }).strict() }),
  async (req, res) => {
    const teamId = await withTransaction(conn => addToTeam(conn, req.valid.params.id, req.valid.body.role, actorOf(req), req));
    res.status(201).json({ team_id: teamId });
  });

export default router;
