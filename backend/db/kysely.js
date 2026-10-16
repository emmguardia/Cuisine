import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';          // Kysely attend un pool callback

/** Paramètres de connexion communs à tous les pools (Better Auth, migrations). */
export function connectionOptions() {
  return {
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z',
    charset:  'utf8mb4',
  };
}

/**
 * Force chaque connexion du pool en UTC : NOW() renvoie alors l'heure UTC,
 * cohérente avec timezone: 'Z' (dates JS lues et écrites en UTC), quel que
 * soit le fuseau configuré sur le serveur MariaDB.
 */
export function forceUtc(pool) {
  pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return pool;
}

export function createKysely(connectionLimit = 5) {
  return new Kysely({
    dialect: new MysqlDialect({
      pool: forceUtc(createPool({ ...connectionOptions(), waitForConnections: true, connectionLimit })),
    }),
  });
}
