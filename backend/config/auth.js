import { betterAuth } from 'better-auth';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';          // pool callback → Kysely dialect
import mysql from 'mysql2/promise';           // pool promise → raw queries dans les hooks

/* ── Instance Kysely pour Better Auth ────────────────────────────────── */
const kyselyDb = new Kysely({
  dialect: new MysqlDialect({
    pool: createPool({
      host:             process.env.DB_HOST,
      user:             process.env.DB_USER,
      password:         process.env.DB_PASSWORD,
      database:         process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit:  5,
      timezone:         'Z',
      charset:          'utf8mb4',
    }),
  }),
});

/* ── Pool promise pour les requêtes raw dans les hooks ────────────────── */
const pool = mysql.createPool({
  host:             process.env.DB_HOST,
  user:             process.env.DB_USER,
  password:         process.env.DB_PASSWORD,
  database:         process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:  3,
  timezone:         'Z',
  charset:          'utf8mb4',
});

/* ── Vérifie l'email dans la table allowed_email ────────────────────────
 * Retourne { allowed: bool, role: string } ou null si DB inaccessible.
 * ─────────────────────────────────────────────────────────────────────── */
async function checkAllowedEmail(email) {
  const [rows] = await pool.execute(
    'SELECT role FROM allowed_email WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  if (!rows.length) return null;
  return rows[0].role;
}

/* ── Better Auth ─────────────────────────────────────────────────── */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr',
  secret:  process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr',
  ],

  database: {
    db:   kyselyDb,
    type: 'mysql',
  },

  socialProviders: {
    google: {
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  user: {
    additionalFields: {
      role: {
        type:         'string',
        defaultValue: 'membre',
        required:     true,
      },
    },
  },

  databaseHooks: {
    /* ── Première connexion : vérifier l'email + attribuer le rôle ── */
    user: {
      create: {
        before: async (user) => {
          const role = await checkAllowedEmail(user.email);
          if (!role) return false;           // email non autorisé
          return { data: { ...user, role } };
        },
      },
    },

    /* ── Chaque connexion : re-valider + mettre à jour le rôle si changé ─ */
    session: {
      create: {
        before: async (session) => {
          const [userRows] = await pool.execute(
            'SELECT email, role FROM `user` WHERE id = ? LIMIT 1',
            [session.userId]
          );
          if (!userRows.length) return false;

          const { email, role: currentRole } = userRows[0];
          const newRole = await checkAllowedEmail(email);
          if (!newRole) return false;        // email retiré de la whitelist

          if (currentRole !== newRole) {
            await pool.execute(
              'UPDATE `user` SET role = ?, updatedAt = NOW(3) WHERE id = ?',
              [newRole, session.userId]
            );
          }

          return { data: session };
        },
      },
    },
  },
});
