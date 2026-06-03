/**
 * Helper Cloudflare R2 partagé — upload (presign) + suppression d'objets.
 *
 * Env vars requis :
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { randomUUID } from 'crypto';

export const ALLOWED_EXTS = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

let client = null;

export function getS3() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) return null;
  if (client) return client;
  client = new S3Client({
    region:         'auto',
    endpoint:       `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function isConfigured() {
  return !!getS3();
}

/**
 * Génère une presigned PUT URL.
 * @returns {{ uploadUrl, publicUrl, key }} ou { error } si format refusé, ou null si R2 non configuré.
 */
export async function presignUpload(folder, filename) {
  const s3 = getS3();
  if (!s3) return null;

  const ext         = extname(filename || '').toLowerCase();
  const contentType = ALLOWED_EXTS[ext];
  if (!contentType) return { error: 'Format non supporté (.jpg .png .webp .gif)' };

  const safeFolder = /^[a-z0-9_-]+$/.test(folder || '') ? folder : 'misc';
  const key        = `${safeFolder}/${randomUUID()}${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME,
      Key:         key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }
  );

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { uploadUrl, publicUrl, key };
}

/** Déduit la clé R2 depuis une URL publique (null si l'URL n'appartient pas au bucket). */
export function keyFromPublicUrl(url) {
  if (!url || !process.env.R2_PUBLIC_URL) return null;
  const base = process.env.R2_PUBLIC_URL.replace(/\/+$/, '');
  if (!url.startsWith(base)) return null;
  return url.slice(base.length).replace(/^\/+/, '') || null;
}

/**
 * Supprime un objet du bucket à partir de son URL publique.
 * Best-effort : ne lève jamais (la suppression DB ne doit pas échouer si R2 râle).
 */
export async function deleteFromR2(url) {
  const s3  = getS3();
  const key = keyFromPublicUrl(url);
  if (!s3 || !key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    key,
    }));
  } catch (err) {
    console.error('[r2] suppression échouée pour', key, '—', err.message);
  }
}
