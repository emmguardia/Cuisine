import mysql from 'mysql2/promise';

/* Pool partagé pour les requêtes métier (recettes, commandes, etc.) */
let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: 'Z',
      charset: 'utf8mb4',
    });
  }
  return pool;
}

/**
 * Helper query — retourne les rows directement
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]>}
 */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}
