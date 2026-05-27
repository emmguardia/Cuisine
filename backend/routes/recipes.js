/**
 * Routes recettes — placeholder
 * GET  /api/recipes       → liste publique
 * POST /api/recipes       → créer (admin)
 * PUT  /api/recipes/:id   → modifier (admin)
 * DELETE /api/recipes/:id → supprimer (admin)
 */

import express from 'express';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/* GET /api/recipes — public */
router.get('/', async (req, res) => {
  // TODO: récupérer depuis la DB
  res.json({ message: 'Liste des recettes — à implémenter', recipes: [] });
});

/* POST /api/recipes — admin seulement */
router.post('/', requireAdmin, async (req, res) => {
  // TODO: créer une recette en DB
  res.status(201).json({ message: 'Recette créée — à implémenter' });
});

/* PUT /api/recipes/:id — admin seulement */
router.put('/:id', requireAdmin, async (req, res) => {
  // TODO: modifier une recette en DB
  res.json({ message: 'Recette modifiée — à implémenter' });
});

/* DELETE /api/recipes/:id — admin seulement */
router.delete('/:id', requireAdmin, async (req, res) => {
  // TODO: supprimer une recette en DB
  res.json({ message: 'Recette supprimée — à implémenter' });
});

export default router;
