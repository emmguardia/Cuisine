/**
 * Demandes à double validation qui touchent aux droits d'administration.
 *
 * Un compte admin compromis ne doit pas pouvoir créer seul un autre admin,
 * ni écarter les autres membres du bureau. Le rôle effectif vient de
 * allowed_email (resynchronisé à chaque connexion) : chaque handler met donc
 * à jour allowed_email ET user, et coupe les sessions en cas de rétrogradation.
 */
import { z } from 'zod';
import { registerHandler } from '../changeRequests.js';
import { HttpError } from '../../lib/errors.js';
import { deleteFromR2 } from '../../config/r2.js';

/** En dessous, la double validation deviendrait impossible. */
export const MIN_ADMINS = 2;

const Role = z.enum(['admin', 'membre']);
const Empty = z.object({}).strict();

async function adminCount(conn) {
  const [[row]] = await conn.execute(`SELECT COUNT(*) AS n FROM allowed_email WHERE role = 'admin'`);
  return Number(row.n);
}

async function assertAdminsRemain(conn, removed) {
  if ((await adminCount(conn)) - removed < MIN_ADMINS) {
    throw new HttpError(409, `Il doit rester au moins ${MIN_ADMINS} administrateurs`);
  }
}

/** Email du demandeur (à l'approbation, l'acteur est le validateur). */
async function requesterEmail(conn, ctx) {
  const id = ctx.requestedBy ?? ctx.actor.id;
  const [rows] = await conn.execute('SELECT email FROM `user` WHERE id = ?', [id]);
  return rows[0]?.email?.toLowerCase() ?? null;
}

async function emailIsAdmin(conn, email) {
  const [rows] = await conn.execute('SELECT role FROM allowed_email WHERE email = ?', [email]);
  return rows[0]?.role === 'admin';
}

async function killSessionsByEmail(conn, email) {
  await conn.execute(
    'DELETE s FROM session s JOIN `user` u ON u.id = s.userId WHERE u.email = ?', [email]
  );
}

async function loadUser(conn, id) {
  const [rows] = await conn.execute('SELECT id, name, email, role FROM `user` WHERE id = ?', [id]);
  return rows[0] ?? null;
}

async function loadEmail(conn, id) {
  const [rows] = await conn.execute('SELECT id, email, role FROM allowed_email WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/* ── Changer le rôle d'un compte ─────────────────────────────────────── */
registerHandler('user.set_role', {
  targetType: 'user',
  payload: z.object({ role: Role }).strict(),
  load: loadUser,
  async check(conn, { current, payload, targetId, ...ctx }) {
    if (!current) throw new HttpError(404, 'Utilisateur introuvable');
    if (current.role === payload.role) throw new HttpError(400, 'Ce compte a déjà ce rôle');
    if (targetId === (ctx.requestedBy ?? ctx.actor.id)) {
      throw new HttpError(400, 'Vous ne pouvez pas modifier votre propre rôle');
    }
    if (payload.role === 'membre' && await emailIsAdmin(conn, current.email.toLowerCase())) {
      await assertAdminsRemain(conn, 1);
    }
  },
  describe: ({ current, payload }) => ({
    label:  `${current.name} (${current.email})`,
    before: { role: current.role },
    after:  { role: payload.role },
  }),
  async apply(conn, { current, payload }) {
    const email = current.email.toLowerCase();
    await conn.execute('UPDATE `user` SET role = ?, updatedAt = NOW(3) WHERE id = ?', [payload.role, current.id]);
    await conn.execute(
      `INSERT INTO allowed_email (email, role, created_at) VALUES (?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [email, payload.role]
    );
    if (payload.role === 'membre') await killSessionsByEmail(conn, email);
  },
});

/* ── Supprimer un compte administrateur (et lui retirer l'accès) ─────── */
registerHandler('user.delete_admin', {
  targetType: 'user',
  payload: Empty,
  load: loadUser,
  async check(conn, { current, targetId, ...ctx }) {
    if (!current) throw new HttpError(404, 'Utilisateur introuvable');
    if (current.role !== 'admin') throw new HttpError(400, 'Ce compte n\'est pas administrateur : suppression directe');
    if (targetId === (ctx.requestedBy ?? ctx.actor.id)) {
      throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
    }
    if (await emailIsAdmin(conn, current.email.toLowerCase())) await assertAdminsRemain(conn, 1);
  },
  describe: ({ current }) => ({
    label:  `${current.name} (${current.email})`,
    before: { compte: 'actif', role: current.role },
    after:  { compte: 'supprimé', acces: 'retiré' },
  }),
  async apply(conn, ctx) {
    const { current } = ctx;
    const [recipes] = await conn.execute('SELECT image_url FROM recipe WHERE author_id = ?', [current.id]);
    ctx.images = recipes.map(r => r.image_url).filter(Boolean);
    await conn.execute('DELETE FROM allowed_email WHERE email = ?', [current.email.toLowerCase()]);
    await conn.execute('DELETE FROM `user` WHERE id = ?', [current.id]);
  },
  async afterCommit({ images = [] }) {
    for (const url of images) await deleteFromR2(url);
  },
});

/* ── Autoriser un nouvel email administrateur ────────────────────────── */
registerHandler('email.add_admin', {
  targetType: 'allowed_email',
  payload: Empty,
  async load(conn, email) {
    const [rows] = await conn.execute('SELECT id, email, role FROM allowed_email WHERE email = ?', [email]);
    return rows[0] ?? null;
  },
  async check(_conn, { current, targetId }) {
    if (!z.email().max(255).safeParse(targetId).success || targetId !== targetId.toLowerCase().trim()) {
      throw new HttpError(400, 'Email invalide');
    }
    if (current) throw new HttpError(409, 'Cet email est déjà dans la liste : changez plutôt son rôle');
  },
  describe: ({ targetId }) => ({
    label:  targetId,
    before: null,
    after:  { email: targetId, role: 'admin' },
  }),
  async apply(conn, { targetId }) {
    await conn.execute(
      `INSERT INTO allowed_email (email, role, created_at) VALUES (?, 'admin', NOW(3))`, [targetId]
    );
    await conn.execute(`UPDATE \`user\` SET role = 'admin', updatedAt = NOW(3) WHERE email = ?`, [targetId]);
  },
});

/* ── Changer le rôle d'un email autorisé ─────────────────────────────── */
registerHandler('email.set_role', {
  targetType: 'allowed_email',
  payload: z.object({ role: Role }).strict(),
  load: loadEmail,
  async check(conn, ctx) {
    const { current, payload } = ctx;
    if (!current) throw new HttpError(404, 'Email introuvable');
    if (current.role === payload.role) throw new HttpError(400, 'Cet email a déjà ce rôle');
    if (current.email.toLowerCase() === await requesterEmail(conn, ctx)) {
      throw new HttpError(400, 'Vous ne pouvez pas modifier votre propre rôle');
    }
    if (current.role === 'admin') await assertAdminsRemain(conn, 1);
  },
  describe: ({ current, payload }) => ({
    label:  current.email,
    before: { role: current.role },
    after:  { role: payload.role },
  }),
  async apply(conn, { current, payload }) {
    await conn.execute('UPDATE allowed_email SET role = ? WHERE id = ?', [payload.role, current.id]);
    await conn.execute('UPDATE `user` SET role = ?, updatedAt = NOW(3) WHERE email = ?', [payload.role, current.email]);
    if (payload.role === 'membre') await killSessionsByEmail(conn, current.email);
  },
});

/* ── Retirer un email administrateur de la liste ─────────────────────── */
registerHandler('email.delete_admin', {
  targetType: 'allowed_email',
  payload: Empty,
  load: loadEmail,
  async check(conn, ctx) {
    const { current } = ctx;
    if (!current) throw new HttpError(404, 'Email introuvable');
    if (current.role !== 'admin') throw new HttpError(400, 'Cet email n\'est pas administrateur : retrait direct');
    if (current.email.toLowerCase() === await requesterEmail(conn, ctx)) {
      throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre email');
    }
    await assertAdminsRemain(conn, 1);
  },
  describe: ({ current }) => ({
    label:  current.email,
    before: { email: current.email, role: current.role },
    after:  null,
  }),
  async apply(conn, { current }) {
    await conn.execute('DELETE FROM allowed_email WHERE id = ?', [current.id]);
    await conn.execute(`UPDATE \`user\` SET role = 'membre', updatedAt = NOW(3) WHERE email = ?`, [current.email]);
    await killSessionsByEmail(conn, current.email);
  },
});
