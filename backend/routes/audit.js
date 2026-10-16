/**
 * Journal d'audit — lecture seule, bureau uniquement.
 * GET /api/admin/audit?before=<id>&limit=50&target_type=...&target_id=...
 * Pagination par curseur (id décroissant).
 */
import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter);

router.get('/',
  validate({
    query: z.object({
      before:      z.coerce.number().int().positive().optional(),
      limit:       z.coerce.number().int().min(1).max(200).default(50),
      target_type: z.string().max(64).optional(),
      target_id:   z.string().max(255).optional(),
    }),
  }),
  async (req, res) => {
    const { before, limit, target_type, target_id } = req.valid.query;
    const where = [];
    const params = [];
    if (before)      { where.push('a.id < ?');          params.push(before); }
    if (target_type) { where.push('a.target_type = ?'); params.push(target_type); }
    if (target_id)   { where.push('a.target_id = ?');   params.push(target_id); }

    const [rows] = await getPool().execute(
      `SELECT a.id, a.created_at, a.actor_id, a.actor_email, u.name AS actor_name,
              a.ip, a.action, a.target_type, a.target_id, a.details
         FROM audit_log a
         LEFT JOIN \`user\` u ON u.id = a.actor_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY a.id DESC
        LIMIT ${limit}`,
      params
    );
    res.json({
      entries: rows.map(r => ({
        ...r,
        id: Number(r.id),
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      })),
    });
  });

export default router;
