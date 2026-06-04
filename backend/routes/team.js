/**
 * Membres de l'équipe — affichés sur /equipe, gérés depuis l'admin.
 * GET    /api/team          → liste publique
 * POST   /api/team          → ajouter (admin)
 * PUT    /api/team/:id       → modifier (admin)
 * DELETE /api/team/:id       → supprimer (admin) + suppression de la photo R2
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { deleteFromR2, isAllowedImageUrl } from '../config/r2.js';

const router = Router();

/* ── GET /api/team — liste publique ─────────────────────────────────── */
router.get('/', async (_req, res) => {
  const [rows] = await getPool().execute(
    `SELECT id, name, role, photo_url, sort_order
       FROM team_member
       ORDER BY sort_order ASC, created_at ASC`
  );
  res.json({ members: rows });
});

/* ── À partir d'ici : admin uniquement ──────────────────────────────── */
router.use(requireAdmin);

/* ── POST /api/team — ajouter ───────────────────────────────────────── */
router.post('/', async (req, res) => {
  const { name, role, photo_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  if (!isAllowedImageUrl(photo_url)) {
    return res.status(400).json({ error: "La photo doit être uploadée via le site" });
  }

  const id = randomUUID();
  const [[agg]] = await getPool().execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM team_member'
  );
  const sort_order = agg.maxOrder + 1;

  await getPool().execute(
    `INSERT INTO team_member (id, name, role, photo_url, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, NOW(3))`,
    [id, name.trim(), role?.trim() || null, photo_url || null, sort_order]
  );

  res.status(201).json({
    id, name: name.trim(), role: role?.trim() || null,
    photo_url: photo_url || null, sort_order,
  });
});

/* ── PUT /api/team/:id — modifier ───────────────────────────────────── */
router.put('/:id', async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT photo_url FROM team_member WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Membre introuvable' });

  const { name, role, photo_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  if (!isAllowedImageUrl(photo_url)) {
    return res.status(400).json({ error: "La photo doit être uploadée via le site" });
  }

  await getPool().execute(
    'UPDATE team_member SET name = ?, role = ?, photo_url = ? WHERE id = ?',
    [name.trim(), role?.trim() || null, photo_url || null, req.params.id]
  );

  // Si la photo a changé, on nettoie l'ancienne dans le bucket
  const oldPhoto = rows[0].photo_url;
  if (oldPhoto && oldPhoto !== photo_url) {
    await deleteFromR2(oldPhoto);
  }

  res.json({ message: 'Membre mis à jour' });
});

/* ── DELETE /api/team/:id — supprimer + photo R2 ────────────────────── */
router.delete('/:id', async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT photo_url FROM team_member WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Membre introuvable' });

  await getPool().execute('DELETE FROM team_member WHERE id = ?', [req.params.id]);

  if (rows[0].photo_url) await deleteFromR2(rows[0].photo_url);

  res.json({ message: 'Membre supprimé' });
});

export default router;
