/**
 * Validation des entrées avec zod.
 *
 *   router.post('/x', validate({ body: schema, params: schema }), handler)
 *
 * Les données validées (et nettoyées) sont dans req.valid.body, req.valid.params,
 * req.valid.query. Les handlers ne lisent jamais req.body directement.
 * Express 5 expose req.query en lecture seule, d'où req.valid.
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return res.status(400).json({
          error: 'Données invalides',
          details: result.error.issues.map(i => ({
            champ:   i.path.join('.') || part,
            message: i.message,
          })),
        });
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
