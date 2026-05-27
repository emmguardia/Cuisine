/**
 * Upload R2 — génère une presigned PUT URL pour Cloudflare R2
 * GET /api/upload/presign?filename=photo.jpg
 *
 * Env vars requis :
 *   R2_ACCOUNT_ID       — identifiant de compte CF
 *   R2_ACCESS_KEY_ID    — clé d'accès R2
 *   R2_SECRET_ACCESS_KEY — secret R2
 *   R2_BUCKET_NAME      — nom du bucket
 *   R2_PUBLIC_URL       — URL publique du bucket (ex: https://pub-xxx.r2.dev)
 */
import { Router } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ALLOWED_EXTS = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

function getS3() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) return null;
  return new S3Client({
    region:   'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/* GET /api/upload/presign?filename=photo.jpg */
router.get('/presign', async (req, res) => {
  const s3 = getS3();
  if (!s3) {
    return res.status(503).json({ error: 'Upload non configuré — R2 manquant' });
  }

  const { filename } = req.query;
  if (!filename) return res.status(400).json({ error: 'filename requis' });

  const ext         = extname(filename).toLowerCase();
  const contentType = ALLOWED_EXTS[ext];
  if (!contentType) {
    return res.status(400).json({ error: 'Format non supporté (.jpg .png .webp .gif)' });
  }

  const key = `recettes/${randomUUID()}${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME,
      Key:         key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }  // 5 min
  );

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  res.json({ uploadUrl, publicUrl });
});

export default router;
