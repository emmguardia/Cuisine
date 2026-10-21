import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, requireSameOrigin } from '../middleware/origin.js';

// Derrière Cloudflare, la vraie IP client est dans CF-Connecting-IP.
// Plus fiable que req.ip qui dépend du nombre exact de proxies (CF→Traefik→nginx).
const clientIpKey = (req) => req.headers['cf-connecting-ip'] || req.ip;

// Les sondes liveness/readiness de kubelet tapent /api/health ~150 fois par
// fenêtre de 15 min depuis la même IP : sans cette exception, le limiter
// renvoie 429 au bout de ~10 min et kubelet tue le pod en boucle.
const isHealthCheck = (req) => req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/health';
const isAdminApi    = (req) => req.originalUrl.startsWith('/api/admin/');

// Limite publique, par IP. Les routes admin ont leurs propres limites :
// un membre du bureau qui saisit la compta dépasserait vite 100 requêtes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  skip: (req) => isHealthCheck(req) || isAdminApi(req),
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes' },
});

// Plafond par IP sur /api/admin, avant authentification : borne le coût des
// tentatives sans session (chaque requête interroge la base pour la session).
const adminIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes' },
});

/**
 * Limite posée directement sur les routeurs publics ou membres (recettes,
 * équipe, envoi d'images), en plus de la limite globale : les écritures sont
 * plafonnées plus bas que les lectures.
 */
export const routeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 300 : 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  skip: isHealthCheck,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
});

/**
 * Formulaire de contact : chaque requête envoie deux emails, dont un à une
 * adresse saisie par le visiteur. Plafond bas pour qu'il ne serve pas de relais.
 */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de messages envoyés, réessayez dans une heure' },
});

/**
 * Limite par membre du bureau, après requireAdmin (clé = id utilisateur).
 * Usage : router.use(requireAdmin, adminUserLimiter)
 */
export const adminUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
});

export function applySecurityMiddleware(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));

  app.use(cors({
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }));

  app.use(compression());

  // Rate limit global (public) et plafond par IP sur l'admin
  app.use('/api/', limiter);
  app.use('/api/admin/', adminIpLimiter);

  // CSRF : origine vérifiée sur toute requête qui modifie quelque chose
  app.use('/api/', requireSameOrigin);

  // Rate limit renforcé sur l'auth
  app.use('/api/auth/', authLimiter);

  // Trust proxy (nginx → pod)
  app.set('trust proxy', 1);
}
