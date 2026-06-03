/**
 * Upload R2 — génère une presigned PUT URL pour Cloudflare R2
 * GET /api/upload/presign?filename=photo.jpg&folder=recettes
 *
 * folder autorisés : recettes (défaut), membres.
 * Config R2 dans config/r2.js.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { presignUpload } from '../config/r2.js';

const router = Router();
router.use(requireAuth);

const ALLOWED_FOLDERS = ['recettes', 'membres'];

/* GET /api/upload/presign?filename=photo.jpg&folder=recettes */
router.get('/presign', async (req, res) => {
  const { filename, folder } = req.query;
  if (!filename) return res.status(400).json({ error: 'filename requis' });

  const targetFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'recettes';

  const result = await presignUpload(targetFolder, filename);
  if (!result) {
    return res.status(503).json({ error: 'Upload non configuré — R2 manquant' });
  }
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ uploadUrl: result.uploadUrl, publicUrl: result.publicUrl });
});

export default router;
