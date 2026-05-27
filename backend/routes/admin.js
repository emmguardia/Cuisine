/**
 * Routes admin — réservées au rôle "admin"
 * GET    /api/admin/recipes      → toutes les recettes
 * GET    /api/admin/users        → tous les membres inscrits
 * PATCH  /api/admin/users/:id   → changer le rôle
 * DELETE /api/admin/users/:id   → supprimer un compte
 * GET    /api/admin/emails       → whitelist emails
 * POST   /api/admin/emails       → ajouter un email
 * PATCH  /api/admin/emails/:id  → changer le rôle d'un email
 * DELETE /api/admin/emails/:id  → retirer un email
 */
import { Router } from 'express';
import { getPool } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin); // toutes les routes ici = admin only

/* ── Recettes ──────────────────────────────────────────────────────── */
router.get('/recipes', async (_req, res) => {
  const [rows] = await getPool().execute(`
    SELECT r.id, r.slug, r.title, r.image_url, r.tags,
           r.time, r.difficulty, r.servings, r.created_at,
           u.name AS author_name, u.email AS author_email, u.id AS author_id
    FROM recipe r
    JOIN \`user\` u ON r.author_id = u.id
    ORDER BY r.created_at DESC
  `);
  res.json({ recipes: rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })) });
});

/* ── Membres inscrits ───────────────────────────────────────────────── */
router.get('/users', async (_req, res) => {
  const [rows] = await getPool().execute(`
    SELECT id, name, email, role, image, createdAt
    FROM \`user\`
    ORDER BY createdAt DESC
  `);
  res.json({ users: rows });
});

router.patch('/users/:id', async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'membre'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
  }

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id FROM `user` WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

  await pool.execute(
    'UPDATE `user` SET role = ?, updatedAt = NOW(3) WHERE id = ?',
    [role, req.params.id]
  );
  res.json({ message: 'Rôle mis à jour' });
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }

  const pool = getPool();
  const [rows] = await pool.execute('SELECT id FROM `user` WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

  await pool.execute('DELETE FROM `user` WHERE id = ?', [req.params.id]);
  res.json({ message: 'Utilisateur supprimé' });
});

/* ── Whitelist emails ───────────────────────────────────────────────── */
router.get('/emails', async (_req, res) => {
  const [rows] = await getPool().execute(
    'SELECT id, email, role, created_at FROM allowed_email ORDER BY role, email'
  );
  res.json({ emails: rows });
});

router.post('/emails', async (req, res) => {
  const { email, role } = req.body;
  if (!email?.trim() || !['admin', 'membre'].includes(role)) {
    return res.status(400).json({ error: 'Email et rôle valides requis' });
  }

  const pool = getPool();
  try {
    await pool.execute(
      'INSERT INTO allowed_email (email, role, created_at) VALUES (?, ?, NOW(3))',
      [email.toLowerCase().trim(), role]
    );
    const [rows] = await pool.execute(
      'SELECT id, email, role, created_at FROM allowed_email WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Cet email est déjà dans la liste' });
    }
    throw err;
  }
});

router.patch('/emails/:id', async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'membre'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT email FROM allowed_email WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Email introuvable' });

  await pool.execute(
    'UPDATE allowed_email SET role = ? WHERE id = ?',
    [role, req.params.id]
  );
  res.json({ message: 'Rôle mis à jour' });
});

router.delete('/emails/:id', async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT email FROM allowed_email WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Email introuvable' });

  if (rows[0].email.toLowerCase() === req.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre email' });
  }

  await pool.execute('DELETE FROM allowed_email WHERE id = ?', [req.params.id]);
  res.json({ message: 'Email retiré' });
});

export default router;
