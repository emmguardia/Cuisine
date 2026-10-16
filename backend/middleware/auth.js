import { auth } from '../config/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Source des sessions. Isolée dans un objet pour que les tests puissent
 * la remplacer sans base de données ni Google.
 */
export const sessionProvider = {
  get: (req) => auth.api.getSession({ headers: fromNodeHeaders(req.headers) }),
};

/* Les refus sur les routes admin sont tracés (repérage des tentatives). */
function logDenied(req, status) {
  if (!req.originalUrl.startsWith('/api/admin')) return;
  console.warn(JSON.stringify({
    event:  'admin_access_denied',
    status,
    method: req.method,
    path:   req.originalUrl.split('?')[0],
    ip:     req.headers['cf-connecting-ip'] || req.ip,
    user:   req.user?.id ?? null,
  }));
}

async function loadSession(req) {
  try {
    return await sessionProvider.get(req);
  } catch {
    return null;
  }
}

/**
 * Vérifie qu'une session valide existe.
 * Injecte req.user et req.session.
 */
export async function requireAuth(req, res, next) {
  const session = await loadSession(req);
  if (!session) {
    logDenied(req, 401);
    return res.status(401).json({ error: 'Non authentifié' });
  }
  req.user    = session.user;
  req.session = session.session;
  next();
}

/**
 * Vérifie qu'une session valide existe ET que le rôle est "admin".
 */
export async function requireAdmin(req, res, next) {
  const session = await loadSession(req);
  if (!session) {
    logDenied(req, 401);
    return res.status(401).json({ error: 'Non authentifié' });
  }
  req.user    = session.user;
  req.session = session.session;
  if (session.user.role !== 'admin') {
    logDenied(req, 403);
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

/**
 * Exige une connexion récente pour les actions critiques (valider une demande,
 * clôturer un exercice…). Le front propose alors de se reconnecter.
 * À placer après requireAdmin / requireAuth.
 */
export function requireFreshSession(maxAgeMinutes = 10) {
  return (req, res, next) => {
    const createdAt = new Date(req.session?.createdAt).getTime();
    if (!createdAt || Date.now() - createdAt > maxAgeMinutes * 60_000) {
      return res.status(403).json({
        error: `Pour cette action, reconnectez-vous (connexion de moins de ${maxAgeMinutes} minutes requise)`,
        code:  'REAUTH_REQUIRED',
      });
    }
    next();
  };
}
