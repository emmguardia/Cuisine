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
const blankToNull = (v) => (typeof v === 'string' && !v.trim() ? null : v);
export const SchoolEmail = z.preprocess(blankToNull,
  z.string().trim().toLowerCase().pipe(
    z.email('Email invalide').max(255).regex(/@guardiaschool\.fr$/, 'Adresse @guardiaschool.fr attendue')
  ).nullish());
const isSchool = (email) => /@guardiaschool\.fr$/i.test(email || '');
export const MemberInput = z.object({
  last_name:  Name,
  first_name: Name,
  email:      z.preprocess(blankToNull,
                z.string().trim().toLowerCase().pipe(z.email('Email invalide').max(255)).nullish()),
  school_email: SchoolEmail,
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
  if (season) { where.push('m.season = ?'); params.push(season); }
  if (q) {
    where.push('(m.last_name LIKE ? OR m.first_name LIKE ? OR m.email LIKE ? OR m.school_email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await getPool().execute(
    `SELECT m.id, m.last_name, m.first_name, m.email, m.school_email, m.joined_on, m.season, m.amount, m.tarif,
            m.channel, m.notes, m.created_at, m.updated_at, t.id AS team_id, t.role AS team_role
       FROM member m LEFT JOIN team_member t ON t.member_id = m.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY m.joined_on DESC, m.last_name`, params
  );
  const [seasons] = await getPool().execute('SELECT DISTINCT season FROM member ORDER BY season DESC');
  return { members: rows.map(toApi), seasons: seasons.map(s => s.season) };
}

export async function createMember(conn, input, actor, { importRef = null, helloassoRef = null, req = null } = {}) {
  const id = randomUUID();
  const schoolEmail = input.school_email ?? (isSchool(input.email) ? input.email.toLowerCase() : null);
  try {
    await conn.execute(
      `INSERT INTO member (id, last_name, first_name, email, school_email, joined_on, season, amount, tarif, channel,
                           helloasso_ref, import_ref, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [id, input.last_name, input.first_name, input.email ?? null, schoolEmail, input.joined_on, input.season,
        input.amount, input.tarif, input.channel, helloassoRef, importRef, input.notes, actor.id]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ce mail Guardia est déjà utilisé par un autre adhérent');
    throw err;
  }
  await audit(conn, req, 'member.create', {
    targetType: 'member', targetId: id, actor, details: { name: `${input.first_name} ${input.last_name}` },
  });
  return id;
}

export async function updateMember(conn, id, input, actor, req) {
  const [rows] = await conn.execute('SELECT first_name, last_name FROM member WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Adhérent introuvable');
  try {
    await conn.execute(
      `UPDATE member SET last_name = ?, first_name = ?, email = ?, school_email = ?, joined_on = ?, season = ?,
                         amount = ?, tarif = ?, channel = ?, notes = ?, updated_at = NOW(3)
        WHERE id = ?`,
      [input.last_name, input.first_name, input.email ?? null, input.school_email ?? null, input.joined_on,
        input.season, input.amount, input.tarif, input.channel, input.notes, id]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ce mail Guardia est déjà utilisé par un autre adhérent');
    throw err;
  }
  // L'équipe affiche le nom de l'adhérent : on le garde à jour.
  await conn.execute('UPDATE team_member SET name = ? WHERE member_id = ?', [`${input.first_name} ${input.last_name}`, id]);
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

/** Renseigne seulement le mail Guardia (saisie rapide depuis la liste). */
export async function setSchoolEmail(conn, id, schoolEmail, actor, req) {
  const [rows] = await conn.execute('SELECT first_name, last_name FROM member WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Adhérent introuvable');
  try {
    await conn.execute('UPDATE member SET school_email = ?, updated_at = NOW(3) WHERE id = ?', [schoolEmail, id]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ce mail Guardia est déjà utilisé par un autre adhérent');
    throw err;
  }
  await audit(conn, req, 'member.update', {
    targetType: 'member', targetId: id, actor, details: { name: `${rows[0].first_name} ${rows[0].last_name}`, champ: 'mail Guardia' },
  });
}

/** Ajoute l'adhérent à l'équipe affichée sur /equipe. */
export async function addToTeam(conn, id, role, actor, req) {
  const [rows] = await conn.execute('SELECT first_name, last_name FROM member WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Adhérent introuvable');
  const [team] = await conn.execute('SELECT id FROM team_member WHERE member_id = ?', [id]);
  if (team.length) throw new HttpError(409, 'Cet adhérent fait déjà partie de l\'équipe');
  const [[agg]] = await conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM team_member');
  const teamId = randomUUID();
  const name = `${rows[0].first_name} ${rows[0].last_name}`;
  await conn.execute(
    `INSERT INTO team_member (id, name, role, photo_url, sort_order, member_id, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, NOW(3))`, [teamId, name, role || 'Membre', Number(agg.maxOrder) + 1, id]
  );
  await audit(conn, req, 'team.create', { targetType: 'team_member', targetId: teamId, actor, details: { name } });
  return teamId;
}
