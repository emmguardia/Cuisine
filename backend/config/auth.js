import { betterAuth } from 'better-auth';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';          // pool callback → Kysely dialect
import mysql from 'mysql2/promise';           // pool promise → raw queries dans les hooks

/* ── Instance Kysely pour Better Auth ────────────────────────────────── *
 * L'adapter attend { db: KyselyInstance, type } (cf. @better-auth/kysely-adapter l.29)
 * Il extrait db.db et appelle insertInto/selectFrom etc. dessus.
 * MysqlDialect prend un pool callback mysql2 (non-promise).
 * ─────────────────────────────────────────────────────────────────────── */
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

/* ── Pool promise pour les requêtes raw dans les databaseHooks ────────── */
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

/* ── Listes d'accès (rechargées à chaque démarrage du pod) ─────────── */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const MEMBRE_EMAILS = (process.env.MEMBRE_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

/* ── Better Auth ─────────────────────────────────────────────────── */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr',
  secret:  process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'https://quisine.zenixweb.fr',
  ],

  // { db: KyselyInstance, type } → détecté par l'adapter ligne 29-33
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

  /* Champ role personnalisé sur la table user */
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
          const email    = user.email?.toLowerCase();
          const isAdmin  = ADMIN_EMAILS.includes(email);
          const isMembre = MEMBRE_EMAILS.includes(email);

          if (!isAdmin && !isMembre) {
            return false;
          }

          return {
            data: { ...user, role: isAdmin ? 'admin' : 'membre' },
          };
        },
      },
    },

    /* ── Chaque connexion : re-valider l'email + mettre à jour le rôle ─ */
    session: {
      create: {
        before: async (session) => {
          const [rows] = await pool.execute(
            'SELECT email, role FROM `user` WHERE id = ?',
            [session.userId]
          );

          if (!rows.length) return false;

          const { email, role: currentRole } = rows[0];
          const emailLower = email?.toLowerCase();
          const isAdmin    = ADMIN_EMAILS.includes(emailLower);
          const isMembre   = MEMBRE_EMAILS.includes(emailLower);

          if (!isAdmin && !isMembre) return false;

          const newRole = isAdmin ? 'admin' : 'membre';

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
