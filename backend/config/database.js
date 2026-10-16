import mysql from 'mysql2/promise';
import { connectionOptions, forceUtc } from '../db/kysely.js';

/* Pool partagé pour les requêtes métier (recettes, commandes, etc.) */
let pool;

export function getPool() {
  if (!pool) {
    pool = forceUtc(mysql.createPool({
      ...connectionOptions(),
      waitForConnections: true,
      connectionLimit: 10,
    }));
  }
  return pool;
}

/**
 * Helper query — retourne les rows directement
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]>}
 */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/* Galera renvoie ER_LOCK_DEADLOCK quand deux nœuds certifient des écritures
 * concurrentes sur les mêmes lignes : on rejoue la transaction une fois. */
const RETRYABLE = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

/**
 * Exécute fn(conn) dans une transaction. Commit si fn réussit, rollback sinon.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn, { retries = 1 } = {}) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (retries > 0 && RETRYABLE.has(err.code)) {
      return withTransaction(fn, { retries: retries - 1 });
    }
    throw err;
  } finally {
    conn.release();
  }
}
