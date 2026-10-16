#!/usr/bin/env node
/**
 * Migrations versionnées de quisine_db (Kysely Migrator).
 *
 * Usage :
 *   node scripts/migrate.js          → applique les migrations en attente
 *   node scripts/migrate.js --status → liste les migrations et leur état
 *
 * En prod, lancé par le Job Helm « cuisine-migrate » (hook ArgoCD PreSync),
 * avant le déploiement du backend.
 *
 * Une migration = un fichier de migrations/, jamais modifié une fois en prod.
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Migrator, FileMigrationProvider } from 'kysely';
import { createKysely } from '../db/kysely.js';

const migrationFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function createMigrator(db) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
  });
}

/* ── Admins à pré-autoriser (bootstrap) ─────────────────────────────
 * Source : secret SEED_ADMIN_EMAILS, jamais en clair dans le code.
 * Format : "a@ecole.fr,b@ecole.fr". Vide = aucun seed
 * (les admins sont alors gérés via /admin → Emails autorisés).
 * ─────────────────────────────────────────────────────────────────── */
async function seedAdmins(db) {
  const emails = (process.env.SEED_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  for (const email of emails) {
    await db.insertInto('allowed_email')
      .values({ email, role: 'admin' })
      .ignore()
      .execute();
  }
  console.log(`[migrate] Whitelist admins : ${emails.length} email(s) seeded`);
}

async function main() {
  const db = createKysely(1);
  const migrator = createMigrator(db);

  try {
    if (process.argv.includes('--status')) {
      for (const m of await migrator.getMigrations()) {
        console.log(`${m.executedAt ? m.executedAt.toISOString() : 'en attente              '}  ${m.name}`);
      }
      return;
    }

    const { error, results } = await migrator.migrateToLatest();
    for (const r of results ?? []) {
      console.log(`[migrate] ${r.migrationName} : ${r.status === 'Success' ? 'OK' : r.status}`);
    }
    if (error) throw error;
    if (!results?.length) console.log('[migrate] Base déjà à jour');

    await seedAdmins(db);
    console.log('[migrate] Migration terminée.');
  } finally {
    await db.destroy();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[migrate] Échec :', err.message);
    process.exit(1);
  });
}
