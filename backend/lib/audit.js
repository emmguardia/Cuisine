/**
 * Journal d'audit (table audit_log, en ajout seul).
 *
 * À appeler dans la même transaction que l'action tracée : si l'action est
 * annulée, la ligne d'audit l'est aussi, et inversement.
 */
export function clientIp(req) {
  return req?.headers?.['cf-connecting-ip'] || req?.ip || null;
}

/**
 * @param {{ execute: Function }} conn  pool ou connexion en transaction
 * @param {import('express').Request | null} req
 * @param {string} action  ex. 'change_request.approve'
 * @param {{ targetType?: string, targetId?: string, details?: object, actor?: { id: string, email?: string } }} [opts]
 */
export async function audit(conn, req, action, { targetType = null, targetId = null, details = null, actor = null } = {}) {
  const who = actor ?? req?.user ?? null;
  await conn.execute(
    `INSERT INTO audit_log (created_at, actor_id, actor_email, ip, action, target_type, target_id, details)
     VALUES (NOW(3), ?, ?, ?, ?, ?, ?, ?)`,
    [
      who?.id ?? null,
      who?.email ?? null,
      clientIp(req),
      action,
      targetType,
      targetId == null ? null : String(targetId),
      details == null ? null : JSON.stringify(details),
    ]
  );
}
