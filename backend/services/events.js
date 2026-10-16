/**
 * Événements (vente de crêpes du vendredi, soirée…) : on y rattache des
 * opérations de la compta — courses d'un côté, paiements reçus de l'autre —
 * pour savoir si l'événement est rentable. Rien n'est écrit en compta.
 *
 * Un lien vise la chaîne d'une opération (origin_id) : si l'opération est
 * corrigée, l'événement suit la version en vigueur ; si elle est annulée,
 * elle ne compte plus. Le montant affecté est facultatif (par défaut, tout le
 * montant) pour répartir un ticket entre plusieurs événements.
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getPool } from '../config/database.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';

export const EventInput = z.object({
  name:        z.string().trim().min(2, 'Nom trop court').max(150),
  date:        z.iso.date('Date invalide'),
  description: z.string().trim().max(2000).nullish().transform(v => v || null),
}).strict();

export const LinkInput = z.object({
  entry_id: z.uuid(),
  amount:   z.number().int().min(1).max(100_000_000).nullish(),
}).strict();

const dateOnly = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/* Version en vigueur de chaque chaîne liée, avec son montant et son sens. */
const LINKED_SQL = `
  SELECT l.event_id, l.origin_id, l.amount AS allocated, l.created_at AS linked_at,
         e.id AS entry_id, e.number, e.date, e.label, e.kind, e.status, e.treasury, e.third_party,
         (SELECT SUM(x.debit) FROM entry_line x WHERE x.entry_id = e.id) AS total
    FROM event_link l
    JOIN entry e ON e.origin_id = l.origin_id
                AND e.kind <> 'contrepassation'
                AND (e.status = 'active' OR e.replaced_by_id IS NULL)`;

function summarize(links) {
  let recettes = 0, depenses = 0;
  const ops = links.map(l => {
    const total = Number(l.total || 0);
    const amount = l.allocated != null ? Math.min(Number(l.allocated), total) : total;
    const counted = l.status === 'active' && (l.kind === 'recette' || l.kind === 'depense');
    if (counted && l.kind === 'recette') recettes += amount;
    if (counted && l.kind === 'depense') depenses += amount;
    return {
      entry_id: l.entry_id, origin_id: l.origin_id, number: l.number, date: dateOnly(l.date), label: l.label,
      kind: l.kind, status: l.status, treasury: l.treasury, third_party: l.third_party,
      total, amount, partial: l.allocated != null, counted,
    };
  });
  return { recettes, depenses, resultat: recettes - depenses, operations: ops };
}

export async function listEvents() {
  const pool = getPool();
  const [events] = await pool.execute('SELECT id, name, date, description FROM event ORDER BY date DESC, created_at DESC');
  const [links] = await pool.execute(LINKED_SQL);
  return events.map(ev => {
    const s = summarize(links.filter(l => l.event_id === ev.id));
    return {
      id: ev.id, name: ev.name, date: dateOnly(ev.date), description: ev.description,
      recettes: s.recettes, depenses: s.depenses, resultat: s.resultat, operations: s.operations.length,
    };
  });
}

export async function getEvent(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, name, date, description, created_at FROM event WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Événement introuvable');
  const [links] = await pool.execute(`${LINKED_SQL} WHERE l.event_id = ? ORDER BY e.date, e.number`, [id]);
  return { ...rows[0], date: dateOnly(rows[0].date), ...summarize(links) };
}

export async function createEvent(conn, input, actor, { importRef = null, req = null } = {}) {
  const id = randomUUID();
  await conn.execute(
    `INSERT INTO event (id, name, date, description, import_ref, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [id, input.name, input.date, input.description, importRef, actor.id]
  );
  await audit(conn, req, 'event.create', { targetType: 'event', targetId: id, actor, details: { name: input.name } });
  return id;
}

export async function updateEvent(conn, id, input, actor, req) {
  const [r] = await conn.execute('UPDATE event SET name = ?, date = ?, description = ?, updated_at = NOW(3) WHERE id = ?',
    [input.name, input.date, input.description, id]);
  if (!r.affectedRows) throw new HttpError(404, 'Événement introuvable');
  await audit(conn, req, 'event.update', { targetType: 'event', targetId: id, actor, details: { name: input.name } });
}

export async function deleteEvent(conn, id, actor, req) {
  const [rows] = await conn.execute('SELECT name FROM event WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Événement introuvable');
  await conn.execute('DELETE FROM event WHERE id = ?', [id]);
  await audit(conn, req, 'event.delete', { targetType: 'event', targetId: id, actor, details: { name: rows[0].name } });
}

/** Rattache une opération (par son id) à l'événement. */
export async function linkEntry(conn, eventId, { entry_id, amount = null }, actor, req) {
  const [ev] = await conn.execute('SELECT name FROM event WHERE id = ?', [eventId]);
  if (!ev.length) throw new HttpError(404, 'Événement introuvable');
  const [rows] = await conn.execute(
    `SELECT e.origin_id, e.number, e.label, e.kind, e.status,
            (SELECT SUM(x.debit) FROM entry_line x WHERE x.entry_id = e.id) AS total
       FROM entry e WHERE e.id = ?`, [entry_id]
  );
  const entry = rows[0];
  if (!entry) throw new HttpError(404, 'Opération introuvable');
  if (entry.status !== 'active' || !['recette', 'depense'].includes(entry.kind)) {
    throw new HttpError(400, 'Seules les recettes et dépenses en vigueur se rattachent à un événement');
  }
  if (amount != null && amount > Number(entry.total)) {
    throw new HttpError(400, 'Le montant affecté dépasse le montant de l\'opération');
  }
  try {
    await conn.execute(
      'INSERT INTO event_link (event_id, origin_id, amount, created_by, created_at) VALUES (?, ?, ?, ?, NOW(3))',
      [eventId, entry.origin_id, amount, actor.id]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Cette opération est déjà rattachée à l\'événement');
    throw err;
  }
  await audit(conn, req, 'event.link', {
    targetType: 'event', targetId: eventId, actor,
    details: { name: ev[0].name, number: entry.number, label: entry.label, amount },
  });
}

export async function unlinkEntry(conn, eventId, originId, actor, req) {
  const [r] = await conn.execute('DELETE FROM event_link WHERE event_id = ? AND origin_id = ?', [eventId, originId]);
  if (!r.affectedRows) throw new HttpError(404, 'Lien introuvable');
  await audit(conn, req, 'event.unlink', { targetType: 'event', targetId: eventId, actor, details: { origin_id: originId } });
}
