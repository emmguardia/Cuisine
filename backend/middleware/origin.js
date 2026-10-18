/**
 * Protection CSRF des routes de l'API.
 *
 * Toute requête qui modifie quelque chose (POST, PUT, PATCH, DELETE) doit
 * venir du site lui-même : l'en-tête Origin (ou à défaut Referer) doit
 * correspondre à l'origine autorisée. Les navigateurs envoient toujours Origin
 * sur ces méthodes, et une page tierce ne peut pas le falsifier.
 *
 * En plus, un corps de requête doit être en JSON : un formulaire HTML
 * cross-site ne peut envoyer que du urlencoded, du multipart ou du text/plain.
 *
 * Exclus : /api/auth (Better Auth applique ses propres trustedOrigins) et
 * /api/webhooks (appelés par des serveurs tiers, authentifiés autrement).
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXCLUDED_PREFIXES = ['/api/auth/', '/api/webhooks/'];

/* Envoi de justificatifs en corps binaire. Ces types ne sont pas « simples »
 * au sens CORS : un site tiers ne peut pas les envoyer sans pré-vérification,
 * refusée par la politique CORS. L'origine est vérifiée comme partout. */
const BINARY_UPLOADS = [
  { path: /^\/api\/admin\/compta\/operations\/[0-9a-f-]{36}\/attachments$/,
    types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
  { path: /^\/api\/admin\/materiel\/[0-9a-f-]{36}\/photo$/,
    types: ['image/jpeg', 'image/png', 'image/webp'] },
];

export function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr')
    .split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requireSameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const path = req.originalUrl.split('?')[0];
  if (EXCLUDED_PREFIXES.some(p => path.startsWith(p))) return next();

  const origins = allowedOrigins();
  const origin  = req.headers.origin ? originOf(req.headers.origin)
                : req.headers.referer ? originOf(req.headers.referer)
                : null;

  if (!origin || !origins.includes(origin)) {
    return res.status(403).json({ error: 'Origine de la requête refusée' });
  }

  const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
  const upload  = BINARY_UPLOADS.find(u => u.path.test(path));
  if (hasBody && upload) {
    if (!req.is(upload.types)) return res.status(415).json({ error: 'Type de fichier refusé' });
    return next();
  }
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ error: 'Le corps de la requête doit être en JSON' });
  }

  next();
}
