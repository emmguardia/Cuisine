/**
 * Demandes à double validation (principe des quatre yeux).
 *
 * Une action sensible n'est jamais appliquée directement : elle crée une
 * demande, qu'un AUTRE membre du bureau approuve ou refuse. Chaque type de
 * demande est décrit par un « handler » enregistré avec registerHandler() :
 *
 *   {
 *     targetType: 'user',
 *     payload:    schéma zod des changements proposés,
 *     load(conn, targetId)            → état actuel de la cible (ou null)
 *     check(conn, ctx)                → lève HttpError si la demande est irrecevable
 *     describe(ctx)                   → { label, before, after } affichés au validateur
 *     apply(conn, ctx)                → applique le changement (dans la transaction)
 *     afterCommit?(ctx)               → effets hors base (ex. suppression R2), best-effort
 *   }
 *   ctx = { targetId, payload, current, actor }
 *
 * Garanties :
 *  - l'auteur ne peut pas trancher sa propre demande (service + CHECK SQL) ;
 *  - une seule demande en attente par cible (index unique sur pending_key) ;
 *  - si la cible a changé depuis la demande, l'approbation est refusée
 *    (empreinte SHA-256 de l'état au moment de la demande) ;
 *  - les demandes expirent au bout de EXPIRY_DAYS jours ;
 *  - tout est tracé dans audit_log, dans la même transaction.
 */
import { createHash, randomUUID } from 'crypto';
import { getPool, withTransaction } from '../config/database.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { jsonColumn } from '../lib/json.js';

export const EXPIRY_DAYS = 14;

const handlers = new Map();

export function registerHandler(type, handler) {
  if (handlers.has(type)) throw new Error(`Handler déjà enregistré : ${type}`);
  handlers.set(type, handler);
}

export function getHandler(type) {
  const h = handlers.get(type);
  if (!h) throw new HttpError(400, 'Type de demande inconnu');
  return h;
}

/** Empreinte stable d'un état (clés triées, dates en ISO). */
export function stateHash(state) {
  const normalize = (v) => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])]));
    }
    return v;
  };
  return createHash('sha256').update(JSON.stringify(normalize(state ?? null))).digest('hex');
}

function pendingKey(targetType, targetId) {
  return `${targetType}:${targetId ?? ''}`;
}

const parseJson = (v) => jsonColumn(v);

function toApi(row) {
  return {
    id:                row.id,
    type:              row.type,
    target_type:       row.target_type,
    target_id:         row.target_id,
    target_label:      row.target_label,
    payload:           parseJson(row.payload),
    before:            parseJson(row.before_state),
    after:             parseJson(row.after_state),
    reason:            row.reason,
    status:            row.status,
    requested_by:      row.requested_by,
    requested_by_name: row.requested_by_name,
    requested_at:      row.requested_at,
    expires_at:        row.expires_at,
    decided_by:        row.decided_by,
    decided_by_name:   row.decided_by_name,
    decided_at:        row.decided_at,
    decision_comment:  row.decision_comment,
  };
}

/** Passe en « expired » les demandes en attente dont l'échéance est passée. */
export async function expireStale(conn = getPool()) {
  await conn.execute(
    `UPDATE change_request
        SET status = 'expired', pending_key = NULL
      WHERE status = 'pending' AND expires_at < NOW(3)`
  );
}

/**
 * Crée une demande. Ne modifie rien d'autre.
 * @returns {Promise<object>} la demande créée
 */
export async function createRequest({ type, targetId = null, payload, reason, actor, req = null }) {
  const handler = getHandler(type);

  const parsed = handler.payload.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new HttpError(400, 'Données invalides', parsed.error.issues.map(i => ({
      champ: i.path.join('.') || 'payload', message: i.message,
    })));
  }

  return withTransaction(async (conn) => {
    await expireStale(conn);

    const current = await handler.load(conn, targetId);
    const ctx = { targetId, payload: parsed.data, current, actor };
    await handler.check(conn, ctx);
    const { label, before, after } = handler.describe(ctx);

    const id = randomUUID();
    try {
      await conn.execute(
        `INSERT INTO change_request
           (id, type, target_type, target_id, target_label, target_hash, payload,
            before_state, after_state, reason, status, requested_by, requested_by_name,
            requested_at, expires_at, pending_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(3),
                 NOW(3) + INTERVAL ${EXPIRY_DAYS} DAY, ?)`,
        [
          id, type, handler.targetType, targetId, label ?? null, stateHash(current),
          JSON.stringify(parsed.data), JSON.stringify(before ?? null), JSON.stringify(after ?? null),
          reason, actor.id, actor.name ?? null, pendingKey(handler.targetType, targetId),
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'Une demande est déjà en attente sur cet élément');
      }
      throw err;
    }

    await audit(conn, req, 'change_request.create', {
      targetType: handler.targetType, targetId,
      details: { request_id: id, type, reason }, actor,
    });

    const [rows] = await conn.execute('SELECT * FROM change_request WHERE id = ?', [id]);
    return toApi(rows[0]);
  });
}

/**
 * Exécute fn(conn, row) dans une transaction, sur une demande verrouillée et
 * encore en attente. Une demande échue est d'abord passée en « expired » : ce
 * changement est validé avant de lever l'erreur (sinon le rollback l'effacerait).
 */
async function onPending(id, fn) {
  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.execute('SELECT * FROM change_request WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'Demande introuvable');
    const row = rows[0];
    if (row.status === 'pending' && new Date(row.expires_at) < new Date()) {
      await conn.execute(
        `UPDATE change_request SET status = 'expired', pending_key = NULL WHERE id = ?`, [id]
      );
      return { expired: true };
    }
    if (row.status !== 'pending') throw new HttpError(409, 'Cette demande a déjà été traitée');
    return { value: await fn(conn, row) };
  });
  if (result.expired) throw new HttpError(409, 'Cette demande a expiré');
  return result.value;
}

/**
 * Approuve et applique une demande. L'approbateur doit être différent du demandeur.
 * Si la cible a changé depuis la demande, la demande devient « obsolete ».
 */
export async function approveRequest({ id, actor, comment = null, req = null }) {
  let afterCommit = null;
  let outcome;

  try {
    outcome = await onPending(id, async (conn, row) => {
      if (row.requested_by === actor.id) {
        throw new HttpError(403, 'Vous ne pouvez pas valider votre propre demande');
      }

      const handler = getHandler(row.type);
      const payload = handler.payload.parse(parseJson(row.payload));
      const current = await handler.load(conn, row.target_id);

      if (stateHash(current) !== row.target_hash) {
        await conn.execute(
          `UPDATE change_request
              SET status = 'obsolete', pending_key = NULL, decided_by = ?, decided_by_name = ?,
                  decided_at = NOW(3), decision_comment = ?
            WHERE id = ?`,
          [actor.id, actor.name ?? null, 'L\'élément a changé depuis la demande', id]
        );
        await audit(conn, req, 'change_request.obsolete', {
          targetType: row.target_type, targetId: row.target_id, details: { request_id: id }, actor,
        });
        return { obsolete: true };
      }

      const ctx = { targetId: row.target_id, payload, current, actor, requestedBy: row.requested_by, reason: row.reason };
      await handler.check(conn, ctx);
      await handler.apply(conn, ctx);
      if (handler.afterCommit) afterCommit = () => handler.afterCommit(ctx);

      await conn.execute(
        `UPDATE change_request
            SET status = 'approved', pending_key = NULL, decided_by = ?, decided_by_name = ?,
                decided_at = NOW(3), decision_comment = ?
          WHERE id = ?`,
        [actor.id, actor.name ?? null, comment, id]
      );
      await audit(conn, req, 'change_request.approve', {
        targetType: row.target_type, targetId: row.target_id,
        details: { request_id: id, type: row.type, payload, comment }, actor,
      });
      return { obsolete: false };
    });
  } catch (err) {
    // Le CHECK SQL est le dernier rempart si la vérification applicative sautait.
    if (err.code === 'ER_CONSTRAINT_FAILED' || err.errno === 4025) {
      throw new HttpError(403, 'Vous ne pouvez pas valider votre propre demande');
    }
    throw err;
  }

  if (outcome.obsolete) {
    throw new HttpError(409, 'L\'élément a été modifié depuis la demande : elle est annulée, refaites-la si besoin');
  }
  if (afterCommit) await Promise.resolve(afterCommit()).catch(err =>
    console.error('[change_request] effet post-validation échoué :', err.message));

  return getRequest(id);
}

export async function rejectRequest({ id, actor, comment = null, req = null }) {
  await onPending(id, async (conn, row) => {
    if (row.requested_by === actor.id) {
      throw new HttpError(403, 'Pour retirer votre propre demande, annulez-la');
    }
    await conn.execute(
      `UPDATE change_request
          SET status = 'rejected', pending_key = NULL, decided_by = ?, decided_by_name = ?,
              decided_at = NOW(3), decision_comment = ?
        WHERE id = ?`,
      [actor.id, actor.name ?? null, comment, id]
    );
    await audit(conn, req, 'change_request.reject', {
      targetType: row.target_type, targetId: row.target_id,
      details: { request_id: id, comment }, actor,
    });
  });
  return getRequest(id);
}

/** Le demandeur retire sa demande (pas de decided_by : ce n'est pas une décision). */
export async function cancelRequest({ id, actor, req = null }) {
  await onPending(id, async (conn, row) => {
    if (row.requested_by !== actor.id) {
      throw new HttpError(403, 'Seul l\'auteur peut annuler sa demande');
    }
    await conn.execute(
      `UPDATE change_request SET status = 'cancelled', pending_key = NULL, decided_at = NOW(3) WHERE id = ?`,
      [id]
    );
    await audit(conn, req, 'change_request.cancel', {
      targetType: row.target_type, targetId: row.target_id, details: { request_id: id }, actor,
    });
  });
  return getRequest(id);
}

export async function getRequest(id) {
  const [rows] = await getPool().execute('SELECT * FROM change_request WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Demande introuvable');
  return toApi(rows[0]);
}

export async function listRequests({ status = 'pending', limit = 100 } = {}) {
  await expireStale();
  const params = [];
  let where = '';
  if (status !== 'all') {
    where = 'WHERE status = ?';
    params.push(status);
  }
  const [rows] = await getPool().execute(
    `SELECT * FROM change_request ${where} ORDER BY requested_at DESC LIMIT ${Number(limit)}`,
    params
  );
  return rows.map(toApi);
}

export async function countPendingFor(userId) {
  await expireStale();
  const [[row]] = await getPool().execute(
    `SELECT
       SUM(requested_by <> ?) AS to_review,
       SUM(requested_by = ?)  AS mine
     FROM change_request WHERE status = 'pending'`,
    [userId, userId]
  );
  return { to_review: Number(row.to_review || 0), mine: Number(row.mine || 0) };
}
