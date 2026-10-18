/**
 * Demandes à double validation du matériel : changer une quantité en dehors
 * d'un contrôle d'inventaire, sortir une fiche de l'inventaire.
 */
import { z } from 'zod';
import { registerHandler } from '../changeRequests.js';
import { HttpError } from '../../lib/errors.js';
import { applyMovement, MOVE_KINDS } from '../equipment.js';

const UP = ['achat', 'retrouve'];
const DOWN = ['perte', 'casse', 'rebut'];
const EXIT = { perdu: 'Perdu', casse: 'Cassé', jete: 'Jeté', donne: 'Donné' };

async function load(conn, id) {
  const [rows] = await conn.execute(
    'SELECT id, name, expected_qty, status FROM equipment WHERE id = ?', [id]
  );
  return rows[0] ?? null;
}

function assertActive(current) {
  if (!current) throw new HttpError(404, 'Matériel introuvable');
  if (current.status !== 'actif') throw new HttpError(409, 'Ce matériel est déjà sorti de l\'inventaire');
}

registerHandler('equipment.adjust', {
  targetType: 'equipment',
  payload: z.object({
    kind:  z.enum([...UP, ...DOWN, 'correction']),
    delta: z.number().int().min(-10_000).max(10_000).refine(n => n !== 0, 'Quantité nulle'),
  }).strict().superRefine((p, ctx) => {
    if (UP.includes(p.kind) && p.delta < 0) ctx.addIssue({ code: 'custom', path: ['delta'], message: 'Un achat ou un objet retrouvé ajoute des unités' });
    if (DOWN.includes(p.kind) && p.delta > 0) ctx.addIssue({ code: 'custom', path: ['delta'], message: 'Une perte, une casse ou un rebut retire des unités' });
  }),
  load,
  async check(_conn, { current, payload }) {
    assertActive(current);
    if (Number(current.expected_qty) + payload.delta < 0) throw new HttpError(400, 'La quantité deviendrait négative');
  },
  describe: ({ current, payload }) => ({
    label:  current.name,
    before: { quantite: current.expected_qty },
    after:  { quantite: Number(current.expected_qty) + payload.delta, mouvement: `${MOVE_KINDS[payload.kind]} (${payload.delta > 0 ? '+' : ''}${payload.delta})` },
  }),
  async apply(conn, ctx) {
    await applyMovement(conn, ctx.targetId, ctx.payload.kind, ctx.payload.delta, ctx.reason ?? null, ctx.actor);
  },
});

registerHandler('equipment.retire', {
  targetType: 'equipment',
  payload: z.object({ exit_reason: z.enum(Object.keys(EXIT)) }).strict(),
  load,
  async check(_conn, { current }) { assertActive(current); },
  describe: ({ current, payload }) => ({
    label:  current.name,
    before: { statut: 'Dans l\'inventaire', quantite: current.expected_qty },
    after:  { statut: `Sorti : ${EXIT[payload.exit_reason].toLowerCase()}`, quantite: 0 },
  }),
  async apply(conn, { targetId, payload, actor, current }) {
    if (Number(current.expected_qty) > 0) {
      await applyMovement(conn, targetId, 'sortie', -Number(current.expected_qty), EXIT[payload.exit_reason], actor);
    }
    await conn.execute(
      `UPDATE equipment SET status = 'sorti', exit_reason = ?, exit_date = CURRENT_DATE, updated_at = NOW(3) WHERE id = ?`,
      [payload.exit_reason, targetId]
    );
  },
});
