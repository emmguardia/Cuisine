/**
 * Demandes à double validation de la compta : corriger ou annuler une
 * opération, retirer un justificatif. Appliquées par écriture inverse :
 * rien n'est effacé.
 */
import { z } from 'zod';
import { registerHandler } from '../changeRequests.js';
import { HttpError } from '../../lib/errors.js';
import {
  OperationInput, entrySnapshot, replaceEntry, cancelEntry, formatEuros, totalOf, TREASURY_LABELS,
} from '../compta.js';

const Empty = z.object({}).strict();

const frDate = (iso) => iso.split('-').reverse().join('/');

async function categoryLabels(conn) {
  const [rows] = await conn.execute('SELECT id, label FROM category');
  return Object.fromEntries(rows.map(r => [r.id, r.label]));
}

/** Vue lisible d'une opération, champ par champ, pour l'écran de validation. */
function summarize(op, labels) {
  if (!op) return null;
  const s = {
    date:    frDate(op.date),
    libelle: op.label,
    montant: formatEuros(totalOf(op)),
  };
  if (op.kind === 'virement') {
    s.moyen = op.to === 'membre'
      ? `${TREASURY_LABELS[op.from]} → remboursement de ${op.third_party}`
      : `${TREASURY_LABELS[op.from]} → ${TREASURY_LABELS[op.to]}`;
  } else {
    s.moyen = TREASURY_LABELS[op.treasury];
    s.ventilation = op.lines
      .map(l => `${labels[l.category] ?? l.category} ${formatEuros(l.amount)}${l.label ? ` (${l.label})` : ''}`)
      .join(' ; ');
  }
  s.tiers = op.third_party ?? null;
  s.notes = op.notes ?? null;
  return s;
}

function assertActive(current) {
  if (!current) throw new HttpError(404, 'Opération introuvable');
  if (current.kind === 'contrepassation') throw new HttpError(400, 'Une écriture d\'annulation ne se modifie pas');
  if (current.status !== 'active') throw new HttpError(409, 'Cette opération a déjà été corrigée ou annulée');
}

registerHandler('entry.update', {
  targetType: 'entry',
  payload: OperationInput,
  load: entrySnapshot,
  async check(conn, ctx) {
    assertActive(ctx.current);
    if (JSON.stringify(summarize(ctx.current.operation, {})) === JSON.stringify(summarize(ctx.payload, {}))) {
      throw new HttpError(400, 'Aucun changement par rapport à l\'opération actuelle');
    }
    ctx.labels = await categoryLabels(conn);
  },
  describe: ({ current, payload, labels }) => ({
    label:  `${current.number} — ${current.operation.label}`,
    before: summarize(current.operation, labels),
    after:  summarize(payload, labels),
  }),
  apply: (conn, { targetId, payload, actor }) => replaceEntry(conn, targetId, payload, actor),
});

registerHandler('entry.cancel', {
  targetType: 'entry',
  payload: Empty,
  load: entrySnapshot,
  async check(conn, ctx) {
    assertActive(ctx.current);
    ctx.labels = await categoryLabels(conn);
  },
  describe: ({ current, labels }) => ({
    label:  `${current.number} — ${current.operation.label}`,
    before: { statut: 'Active', ...summarize(current.operation, labels) },
    after:  { statut: 'Annulée (écriture inverse)' },
  }),
  apply: (conn, { targetId, actor }) => cancelEntry(conn, targetId, actor),
});

registerHandler('attachment.remove', {
  targetType: 'attachment',
  payload: Empty,
  async load(conn, id) {
    const [rows] = await conn.execute(
      `SELECT a.id, a.filename, a.sha256, a.removed_at, e.number
         FROM attachment a JOIN entry e ON e.id = a.origin_id WHERE a.id = ?`, [id]
    );
    return rows[0] ?? null;
  },
  async check(_conn, { current }) {
    if (!current) throw new HttpError(404, 'Justificatif introuvable');
    if (current.removed_at) throw new HttpError(409, 'Ce justificatif a déjà été retiré');
  },
  describe: ({ current }) => ({
    label:  `${current.filename} (${current.number})`,
    before: { fichier: current.filename },
    after:  { fichier: 'retiré (conservé dans l\'historique)' },
  }),
  async apply(conn, { targetId, actor }) {
    await conn.execute(
      'UPDATE attachment SET removed_at = NOW(3), removed_by = ? WHERE id = ?', [actor.id, targetId]
    );
  },
});
