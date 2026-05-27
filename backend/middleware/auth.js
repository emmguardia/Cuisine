import { auth } from '../config/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Vérifie qu'une session valide existe.
 * Injecte req.user et req.session.
 */
export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    req.user    = session.user;
    req.session = session.session;
    next();
  } catch {
    res.status(401).json({ error: 'Session invalide' });
  }
}

/**
 * Vérifie qu'une session valide existe ET que le rôle est "admin".
 */
export async function requireAdmin(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    req.user    = session.user;
    req.session = session.session;
    next();
  } catch {
    res.status(401).json({ error: 'Session invalide' });
  }
}
