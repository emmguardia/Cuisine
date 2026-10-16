/**
 * Base de test partagée par les tests d'intégration (*.db.test.js).
 * Ignorés si TEST_DB_HOST n'est pas défini. Vide entièrement la base visée.
 */
export const dbEnabled = !!process.env.TEST_DB_HOST;

if (dbEnabled) {
  if (!/test/i.test(process.env.TEST_DB_NAME || '')) {
    throw new Error('TEST_DB_NAME doit contenir « test » : ces tests vident la base');
  }
  Object.assign(process.env, {
    DB_HOST:     process.env.TEST_DB_HOST,
    DB_PORT:     process.env.TEST_DB_PORT || '3306',
    DB_USER:     process.env.TEST_DB_USER,
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    DB_NAME:     process.env.TEST_DB_NAME,
  });
}

/** Supprime toutes les tables puis rejoue les migrations. */
export async function resetDatabase(pool) {
  const [tables] = await pool.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of tables) await pool.query(`DROP TABLE \`${Object.values(t)[0]}\``);
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  const { createKysely } = await import('../../db/kysely.js');
  const { createMigrator } = await import('../../scripts/migrate.js');
  const db = createKysely(1);
  const { error } = await createMigrator(db).migrateToLatest();
  await db.destroy();
  if (error) throw error;
}

export const USERS = {
  A: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Alice', email: 'alice@test.fr' },
  B: { id: 'b0000000-0000-4000-8000-000000000002', name: 'Bruno', email: 'bruno@test.fr' },
  C: { id: 'c0000000-0000-4000-8000-000000000003', name: 'Chloé', email: 'chloe@test.fr' },
  M: { id: 'd0000000-0000-4000-8000-000000000004', name: 'Malik', email: 'malik@test.fr' },
};

export async function seedUsers(pool) {
  for (const [key, role] of [['A', 'admin'], ['B', 'admin'], ['C', 'admin'], ['M', 'membre']]) {
    const u = USERS[key];
    await pool.execute(
      'INSERT IGNORE INTO `user` (id, name, email, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))',
      [u.id, u.name, u.email, role]
    );
    await pool.execute('INSERT IGNORE INTO allowed_email (email, role) VALUES (?, ?)', [u.email, role]);
  }
}
