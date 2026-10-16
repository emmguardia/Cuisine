/** Erreur métier avec code HTTP, renvoyée telle quelle au client. */
export class HttpError extends Error {
  constructor(status, message, details = undefined, code = undefined) {
    super(message);
    this.status  = status;
    this.details = details;
    this.code    = code;
  }
}

/** Gestionnaire d'erreurs Express : n'expose jamais le détail d'une erreur interne. */
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.code    ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse' });
  }
  console.error('[error]', req.method, req.originalUrl.split('?')[0], err.message);
  res.status(500).json({ error: 'Erreur serveur interne' });
}
