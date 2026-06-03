#!/usr/bin/env node
/**
 * Migration DB — crée/met à jour les tables de quisine_db
 * Usage : node scripts/migrate.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host:     process.env.DB_HOST     || '192.168.1.32',
  user:     process.env.DB_USER     || 'quisine_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'quisine_db',
  charset:  'utf8mb4',
  multipleStatements: true,
});

const tables = [
  /* ── Better Auth ─────────────────────────────────────────────── */
  [`user`, `CREATE TABLE IF NOT EXISTS \`user\` (
    \`id\`            varchar(36)   NOT NULL,
    \`name\`          varchar(255)  NOT NULL,
    \`email\`         varchar(255)  NOT NULL,
    \`emailVerified\` tinyint(1)    NOT NULL DEFAULT 0,
    \`image\`         varchar(2083),
    \`role\`          varchar(50)   NOT NULL DEFAULT 'membre',
    \`createdAt\`     datetime(3)   NOT NULL,
    \`updatedAt\`     datetime(3)   NOT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`user_email_unique\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  [`session`, `CREATE TABLE IF NOT EXISTS \`session\` (
    \`id\`          varchar(36)  NOT NULL,
    \`expiresAt\`   datetime(3)  NOT NULL,
    \`token\`       varchar(255) NOT NULL,
    \`createdAt\`   datetime(3)  NOT NULL,
    \`updatedAt\`   datetime(3)  NOT NULL,
    \`ipAddress\`   varchar(255),
    \`userAgent\`   text,
    \`userId\`      varchar(36)  NOT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`session_token_unique\` (\`token\`),
    KEY \`session_userId_idx\` (\`userId\`),
    CONSTRAINT \`session_userId_fkey\`
      FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  [`account`, `CREATE TABLE IF NOT EXISTS \`account\` (
    \`id\`                     varchar(36)  NOT NULL,
    \`accountId\`              varchar(255) NOT NULL,
    \`providerId\`             varchar(255) NOT NULL,
    \`userId\`                 varchar(36)  NOT NULL,
    \`accessToken\`            text,
    \`refreshToken\`           text,
    \`idToken\`                text,
    \`accessTokenExpiresAt\`   datetime(3),
    \`refreshTokenExpiresAt\`  datetime(3),
    \`scope\`                  text,
    \`password\`               varchar(255),
    \`createdAt\`              datetime(3)  NOT NULL,
    \`updatedAt\`              datetime(3)  NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`account_userId_idx\` (\`userId\`),
    CONSTRAINT \`account_userId_fkey\`
      FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  [`verification`, `CREATE TABLE IF NOT EXISTS \`verification\` (
    \`id\`         varchar(36)  NOT NULL,
    \`identifier\` varchar(255) NOT NULL,
    \`value\`      text         NOT NULL,
    \`expiresAt\`  datetime(3)  NOT NULL,
    \`createdAt\`  datetime(3),
    \`updatedAt\`  datetime(3),
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  /* ── Whitelist emails (remplace les env vars ADMIN_EMAILS/MEMBRE_EMAILS) */
  [`allowed_email`, `CREATE TABLE IF NOT EXISTS \`allowed_email\` (
    \`id\`         int          NOT NULL AUTO_INCREMENT,
    \`email\`      varchar(255) NOT NULL,
    \`role\`       varchar(50)  NOT NULL DEFAULT 'membre',
    \`created_at\` datetime(3)  NOT NULL DEFAULT NOW(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`allowed_email_unique\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  /* ── Recettes ──────────────────────────────────────────────────── */
  [`recipe`, `CREATE TABLE IF NOT EXISTS \`recipe\` (
    \`id\`          varchar(36)   NOT NULL,
    \`slug\`        varchar(300)  NOT NULL,
    \`title\`       varchar(255)  NOT NULL,
    \`description\` text,
    \`image_url\`   varchar(1024),
    \`tags\`        json,
    \`time\`        varchar(50),
    \`difficulty\`  varchar(50)   NOT NULL DEFAULT 'Moyen',
    \`servings\`    int           NOT NULL DEFAULT 4,
    \`ingredients\` json,
    \`steps\`       json,
    \`author_id\`   varchar(36)   NOT NULL,
    \`created_at\`  datetime(3)   NOT NULL DEFAULT NOW(3),
    \`updated_at\`  datetime(3)   NOT NULL DEFAULT NOW(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`recipe_slug_unique\` (\`slug\`),
    KEY \`recipe_author_idx\` (\`author_id\`),
    CONSTRAINT \`recipe_author_fkey\`
      FOREIGN KEY (\`author_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],

  /* ── Membres de l'équipe (affichés sur /equipe, gérés depuis l'admin) */
  [`team_member`, `CREATE TABLE IF NOT EXISTS \`team_member\` (
    \`id\`         varchar(36)   NOT NULL,
    \`name\`       varchar(255)  NOT NULL,
    \`role\`       varchar(255),
    \`photo_url\`  varchar(1024),
    \`sort_order\` int           NOT NULL DEFAULT 0,
    \`created_at\` datetime(3)   NOT NULL DEFAULT NOW(3),
    PRIMARY KEY (\`id\`),
    KEY \`team_member_order_idx\` (\`sort_order\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`],
];

/* ── Admins à pré-autoriser dans la whitelist ──────────────────────
 * Ces emails sont déjà connus. INSERT IGNORE si déjà présents.
 * ─────────────────────────────────────────────────────────────────── */
const SEED_ADMINS = [
  'ddathueyt@guardiaschool.fr',
  'seed-removed@example.invalid',
  'seed-removed@example.invalid',
  'seed-removed@example.invalid',
  'emonnet-mata@guardiaschool.fr',
];

console.log('[migrate] Connexion à quisine_db...');

for (const [name, sql] of tables) {
  await conn.execute(sql);
  console.log(`[migrate] Table \`${name}\` : OK`);
}

/* Seed whitelist */
for (const email of SEED_ADMINS) {
  await conn.execute(
    'INSERT IGNORE INTO allowed_email (email, role) VALUES (?, ?)',
    [email, 'admin']
  );
}
console.log('[migrate] Whitelist admins : seeded');

await conn.end();
console.log('[migrate] Migration terminée.');
