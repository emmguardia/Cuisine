import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function toSlug(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseRecipe(r) {
  return {
    ...r,
    tags:        JSON.parse(r.tags        || '[]'),
    ingredients: JSON.parse(r.ingredients || '[]'),
    steps:       JSON.parse(r.steps       || '[]'),
  };
}

/* ── GET /api/recipes — liste publique ──────────────────────────────── */
router.get('/', async (_req, res) => {
  const [rows] = await getPool().execute(`
    SELECT r.id, r.slug, r.title, r.description, r.image_url,
           r.tags, r.time, r.difficulty, r.servings, r.created_at,
           u.name AS author_name
    FROM recipe r
    JOIN \`user\` u ON r.author_id = u.id
    ORDER BY r.created_at DESC
  `);
  res.json({ recipes: rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })) });
});

/* ── GET /api/recipes/mine — mes recettes (auth) ─────────────────────
 * Doit être AVANT /:id pour ne pas être capturé comme id.
 * ─────────────────────────────────────────────────────────────────── */
router.get('/mine', requireAuth, async (req, res) => {
  const [rows] = await getPool().execute(`
    SELECT id, slug, title, description, image_url,
           tags, time, difficulty, servings, created_at
    FROM recipe
    WHERE author_id = ?
    ORDER BY created_at DESC
  `, [req.user.id]);
  res.json({ recipes: rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })) });
});

/* ── GET /api/recipes/:id — détail (id ou slug, public) ─────────────── */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const [rows] = await getPool().execute(`
    SELECT r.*, u.name AS author_name, u.id AS author_id
    FROM recipe r
    JOIN \`user\` u ON r.author_id = u.id
    WHERE r.id = ? OR r.slug = ?
    LIMIT 1
  `, [id, id]);

  if (!rows.length) return res.status(404).json({ error: 'Recette introuvable' });
  res.json(parseRecipe(rows[0]));
});

/* ── POST /api/recipes — créer (auth) ───────────────────────────────── */
router.post('/', requireAuth, async (req, res) => {
  const { title, description, image_url, tags, time, difficulty, servings, ingredients, steps } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });

  const id = randomUUID();
  let slug = toSlug(title);

  const [existing] = await getPool().execute('SELECT id FROM recipe WHERE slug = ?', [slug]);
  if (existing.length) slug = `${slug}-${Date.now()}`;

  await getPool().execute(`
    INSERT INTO recipe
      (id, slug, title, description, image_url, tags, time, difficulty, servings, ingredients, steps, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
  `, [
    id, slug, title.trim(),
    description || null,
    image_url   || null,
    JSON.stringify(Array.isArray(tags)        ? tags        : []),
    time        || null,
    difficulty  || 'Moyen',
    Number(servings) || 4,
    JSON.stringify(Array.isArray(ingredients) ? ingredients : []),
    JSON.stringify(Array.isArray(steps)       ? steps       : []),
    req.user.id,
  ]);

  res.status(201).json({ id, slug });
});

/* ── PUT /api/recipes/:id — modifier (propriétaire ou admin) ─────────── */
router.put('/:id', requireAuth, async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT author_id FROM recipe WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Recette introuvable' });
  if (rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  const { title, description, image_url, tags, time, difficulty, servings, ingredients, steps } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });

  await getPool().execute(`
    UPDATE recipe SET
      title = ?, description = ?, image_url = ?,
      tags = ?, time = ?, difficulty = ?, servings = ?,
      ingredients = ?, steps = ?, updated_at = NOW(3)
    WHERE id = ?
  `, [
    title.trim(),
    description || null,
    image_url   || null,
    JSON.stringify(Array.isArray(tags)        ? tags        : []),
    time        || null,
    difficulty  || 'Moyen',
    Number(servings) || 4,
    JSON.stringify(Array.isArray(ingredients) ? ingredients : []),
    JSON.stringify(Array.isArray(steps)       ? steps       : []),
    req.params.id,
  ]);

  res.json({ message: 'Recette mise à jour' });
});

/* ── DELETE /api/recipes/:id — supprimer (propriétaire ou admin) ─────── */
router.delete('/:id', requireAuth, async (req, res) => {
  const [rows] = await getPool().execute(
    'SELECT author_id FROM recipe WHERE id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Recette introuvable' });
  if (rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  await getPool().execute('DELETE FROM recipe WHERE id = ?', [req.params.id]);
  res.json({ message: 'Recette supprimée' });
});

export default router;
