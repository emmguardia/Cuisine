/**
 * Adhérents du club. Données personnelles : lecture et écriture réservées au
 * bureau, chaque modification est tracée. Un adhérent peut être supprimé
 * (droit à l'effacement) ; le paiement de son adhésion reste en compta.
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getPool } from '../config/database.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';

export const CHANNELS = ['helloasso', 'sumup', 'virement', 'especes', 'autre'];

const Name = z.string().trim().min(1, 'Requis').max(100);
export const MemberInput = z.object({
  last_name:  Name,
  first_name: Name,
  email:      z.preprocess(v => (typeof v === 'string' && !v.trim() ? null : v),
                z.string().trim().toLowerCase().pipe(z.email('Email invalide').max(255)).nullish()),
  joined_on:  z.iso.date('Date invalide'),
  season:     z.string().trim().regex(/^\d{4}-\d{4}$/, 'Saison au format 2026-2027'),
  amount:     z.number().int().min(0).max(100_000),
  tarif:      z.string().trim().max(100).nullish().transform(v => v || null),
  channel:    z.enum(CHANNELS),
  notes:      z.string().trim().max(1000).nullish().transform(v => v || null),
}).strict();

const dateOnly = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const toApi = (r) => ({ ...r, joined_on: dateOnly(r.joined_on), amount: Number(r.amount) });

export async function listMembers({ season, q } = {}) {
  const where = [];
  const params = [];
  if (season) { where.push('season = ?'); params.push(season); }
  if (q) {
    where.push('(last_name LIKE ? OR first_name LIKE ? OR email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await getPool().execute(
    `SELECT id, last_name, first_name, email, joined_on, season, amount, tarif, channel, notes, created_at, updated_at
       FROM member ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY joined_on DESC, last_name`, params
  );
  const [seasons] = await getPool().execute('SELECT DISTINCT season FROM member ORDER BY season DESC');
  return { members: rows.map(toApi), seasons: seasons.map(s => s.season) };
}

export async function createMember(conn, input, actor, { importRef = null, helloassoRef = null, req = null } = {}) {
  const id = randomUUID();
  await conn.execute(
    `INSERT INTO member (id, last_name, first_name, email, joined_on, season, amount, tarif, channel,
                         helloasso_ref, import_ref, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [id, input.last_name, input.first_name, input.email ?? null, input.joined_on, input.season, input.amount,
      input.tarif, input.channel, helloassoRef, importRef, input.notes, actor.id]
  );
  await audit(conn, req, 'member.create', {
    targetType: 'member', targetId: id, actor, details: { name: `${input.first_name} ${input.last_name}` },
  });
  return id;
}

export async function updateMember(conn, id, input, actor, req) {
  const [rows] = await conn.execute('SELECT first_name, last_name FROM member WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Adhérent introuvable');
  await conn.execute(
    `UPDATE member SET last_name = ?, first_name = ?, email = ?, joined_on = ?, season = ?, amount = ?,
                       tarif = ?, channel = ?, notes = ?, updated_at = NOW(3)
      WHERE id = ?`,
    [input.last_name, input.first_name, input.email ?? null, input.joined_on, input.season, input.amount,
      input.tarif, input.channel, input.notes, id]
  );
  await audit(conn, req, 'member.update', {
    targetType: 'member', targetId: id, actor, details: { name: `${input.first_name} ${input.last_name}` },
  });
}

export async function deleteMember(conn, id, actor, req) {
  const [rows] = await conn.execute('SELECT first_name, last_name FROM member WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Adhérent introuvable');
  await conn.execute('DELETE FROM member WHERE id = ?', [id]);
  // Le journal garde le nom, pas l'email : minimisation des données.
  await audit(conn, req, 'member.delete', {
    targetType: 'member', targetId: id, actor, details: { name: `${rows[0].first_name} ${rows[0].last_name}` },
  });
}
