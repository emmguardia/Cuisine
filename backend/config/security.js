import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const ORIGIN = process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr';

// Derrière Cloudflare, la vraie IP client est dans CF-Connecting-IP.
// Plus fiable que req.ip qui dépend du nombre exact de proxies (CF→Traefik→nginx).
const clientIpKey = (req) => req.headers['cf-connecting-ip'] || req.ip;

// Les sondes liveness/readiness de kubelet tapent /api/health ~150 fois par
// fenêtre de 15 min depuis la même IP : sans cette exception, le limiter
// renvoie 429 au bout de ~10 min et kubelet tue le pod en boucle.
const isHealthCheck = (req) => req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/health';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  skip: isHealthCheck,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes' },
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
    origin: ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }));

  app.use(compression());

  // Rate limit global
  app.use('/api/', limiter);

  // Rate limit renforcé sur l'auth
  app.use('/api/auth/', authLimiter);

  // Trust proxy (nginx → pod)
  app.set('trust proxy', 1);
}
