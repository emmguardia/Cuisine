/**
 * Exécution d'une synchronisation : un seul passage à la fois par fournisseur
 * (bail en base, valable sur tous les pods), état et erreurs enregistrés.
 */
import { getPool } from '../../config/database.js';
import { jsonColumn } from '../../lib/json.js';
import { audit } from '../../lib/audit.js';
import { IntegrationError } from './http.js';

const LEASE_SECONDS = 300;

export async function loadState(provider) {
  const [rows] = await getPool().execute('SELECT * FROM integration_state WHERE provider = ?', [provider]);
  if (!rows.length) throw new Error(`Intégration inconnue : ${provider}`);
  const r = rows[0];
  return { ...r, cursor: jsonColumn(r.cursor_state, {}), last_result: jsonColumn(r.last_result) };
}

async function acquire(provider) {
  const [r] = await getPool().execute(
    `UPDATE integration_state SET lease_until = NOW(3) + INTERVAL ${LEASE_SECONDS} SECOND, last_run_at = NOW(3)
      WHERE provider = ? AND (lease_until IS NULL OR lease_until < NOW(3))`, [provider]
  );
  return r.affectedRows === 1;
}

export async function saveCursor(provider, cursor) {
  await getPool().execute('UPDATE integration_state SET cursor_state = ? WHERE provider = ?', [JSON.stringify(cursor), provider]);
}

/**
 * @param {string} provider
 * @param {(ctx: { cursor: object, save: (c: object) => Promise<void> }) => Promise<object>} work
 * @returns {Promise<{ skipped?: true, created?: string[], error?: string }>}
 */
export async function runExclusive(provider, work, { trigger = 'cron', actor = null } = {}) {
  if (!(await acquire(provider))) return { skipped: true, reason: 'Synchronisation déjà en cours' };
  const pool = getPool();
  try {
    const state = await loadState(provider);
    const result = await work({ cursor: state.cursor, save: (c) => saveCursor(provider, c) });
    await pool.execute(
      `UPDATE integration_state SET lease_until = NULL, last_success_at = NOW(3), last_result = ? WHERE provider = ?`,
      [JSON.stringify({ ...result, trigger }), provider]
    );
    if (result.created?.length) {
      await audit(pool, null, 'integration.sync', {
        targetType: 'integration', targetId: provider, actor,
        details: { trigger, created: result.created.length, numbers: result.created.slice(0, 50) },
      });
    }
    return result;
  } catch (err) {
    // Message court et sans détail technique sensible.
    const message = (err instanceof IntegrationError ? err.message : `Erreur interne : ${err.message}`).slice(0, 480);
    console.error(`[sync:${provider}]`, err.message);
    await pool.execute(
      `UPDATE integration_state SET lease_until = NULL, last_error = ?, last_error_at = NOW(3) WHERE provider = ?`,
      [message, provider]
    );
    return { error: message };
  }
}
