/**
 * Routes admin — réservées au rôle "admin"
 * GET    /api/admin/recipes      → toutes les recettes
 * GET    /api/admin/users        → tous les comptes inscrits
 * DELETE /api/admin/users/:id   → supprimer un compte membre
 * GET    /api/admin/emails       → whitelist emails
 * POST   /api/admin/emails       → ajouter un email membre
 * DELETE /api/admin/emails/:id  → retirer un email membre
 *
 * Tout ce qui touche aux droits d'administration (changer un rôle, ajouter ou
 * retirer un admin, supprimer un compte admin) passe par une demande à double
 * validation : POST /api/admin/requests (routes/requests.js). Les routes
 * ci-dessous renvoient 409 REQUEST_REQUIRED dans ces cas.
 */
import { Router } from 'express';
import { z } from 'zod';
import { getPool, withTransaction } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminUserLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import { deleteFromR2 } from '../config/r2.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';

const router = Router();
router.use(requireAdmin, adminUserLimiter); // toutes les routes ici = admin only

const requestRequired = (message) => new HttpError(409, message, undefined, 'REQUEST_REQUIRED');

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

/* ── Comptes inscrits ───────────────────────────────────────────────── */
router.get('/users', async (_req, res) => {
  const [rows] = await getPool().execute(`
    SELECT id, name, email, role, image, createdAt
    FROM \`user\`
    ORDER BY createdAt DESC
  `);
  res.json({ users: rows });
});

router.delete('/users/:id',
  validate({ params: z.object({ id: z.string().min(1).max(36) }) }),
  async (req, res) => {
    const { id } = req.valid.params;
    if (id === req.user.id) {
      throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
    }

    const images = await withTransaction(async (conn) => {
      const [rows] = await conn.execute(
        'SELECT id, name, email, role FROM `user` WHERE id = ? FOR UPDATE', [id]
      );
      if (!rows.length) throw new HttpError(404, 'Utilisateur introuvable');
      if (rows[0].role === 'admin') {
        throw requestRequired('Supprimer un compte administrateur demande la validation d\'un autre membre du bureau');
      }

      // Images des recettes de l'utilisateur (supprimées en cascade par la DB) → nettoyage R2
      const [recipeRows] = await conn.execute('SELECT image_url FROM recipe WHERE author_id = ?', [id]);
      await conn.execute('DELETE FROM `user` WHERE id = ?', [id]);
      await audit(conn, req, 'user.delete', {
        targetType: 'user', targetId: id, details: { name: rows[0].name, email: rows[0].email },
      });
      return recipeRows.map(r => r.image_url).filter(Boolean);
    });

    for (const url of images) await deleteFromR2(url);
    res.json({ message: 'Utilisateur supprimé' });
  });

/* ── Whitelist emails ───────────────────────────────────────────────── */
router.get('/emails', async (_req, res) => {
  const [rows] = await getPool().execute(
    'SELECT id, email, role, created_at FROM allowed_email ORDER BY role, email'
  );
  res.json({ emails: rows });
});

router.post('/emails',
  validate({
    body: z.object({
      email: z.string().trim().toLowerCase().pipe(z.email('Email invalide').max(255)),
      role:  z.enum(['admin', 'membre']),
    }).strict(),
  }),
  async (req, res) => {
    const { email, role } = req.valid.body;
    if (role === 'admin') {
      throw requestRequired('Ajouter un administrateur demande la validation d\'un autre membre du bureau');
    }

    const created = await withTransaction(async (conn) => {
      try {
        await conn.execute(
          'INSERT INTO allowed_email (email, role, created_at) VALUES (?, ?, NOW(3))', [email, role]
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Cet email est déjà dans la liste');
        throw err;
      }
      const [rows] = await conn.execute(
        'SELECT id, email, role, created_at FROM allowed_email WHERE email = ?', [email]
      );
      await audit(conn, req, 'allowed_email.add', {
        targetType: 'allowed_email', targetId: rows[0].id, details: { email, role },
      });
      return rows[0];
    });
    res.status(201).json(created);
  });

router.delete('/emails/:id',
  validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  async (req, res) => {
    const { id } = req.valid.params;
    await withTransaction(async (conn) => {
      const [rows] = await conn.execute(
        'SELECT email, role FROM allowed_email WHERE id = ? FOR UPDATE', [id]
      );
      if (!rows.length) throw new HttpError(404, 'Email introuvable');
      const { email, role } = rows[0];

      if (email.toLowerCase() === req.user.email.toLowerCase()) {
        throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre email');
      }
      if (role === 'admin') {
        throw requestRequired('Retirer un administrateur demande la validation d\'un autre membre du bureau');
      }

      await conn.execute('DELETE FROM allowed_email WHERE id = ?', [id]);
      // Sans ça, la personne garderait sa session ouverte jusqu'à expiration.
      await conn.execute(
        'DELETE s FROM session s JOIN `user` u ON u.id = s.userId WHERE u.email = ?', [email]
      );
      await audit(conn, req, 'allowed_email.delete', {
        targetType: 'allowed_email', targetId: id, details: { email, role },
      });
    });
    res.json({ message: 'Email retiré' });
  });

export default router;
