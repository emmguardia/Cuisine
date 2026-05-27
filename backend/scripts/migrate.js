#!/usr/bin/env node
/**
 * Migration DB — crée les tables Better Auth dans quisine_db
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
});

const tables = [
  /* user */
  `CREATE TABLE IF NOT EXISTS \`user\` (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* session */
  `CREATE TABLE IF NOT EXISTS \`session\` (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* account (OAuth) */
  `CREATE TABLE IF NOT EXISTS \`account\` (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  /* verification */
  `CREATE TABLE IF NOT EXISTS \`verification\` (
    \`id\`         varchar(36)  NOT NULL,
    \`identifier\` varchar(255) NOT NULL,
    \`value\`      text         NOT NULL,
    \`expiresAt\`  datetime(3)  NOT NULL,
    \`createdAt\`  datetime(3),
    \`updatedAt\`  datetime(3),
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

console.log('[migrate] Connexion à quisine_db...');

for (const sql of tables) {
  const name = sql.match(/TABLE IF NOT EXISTS `(\w+)`/)?.[1];
  await conn.execute(sql);
  console.log(`[migrate] Table \`${name}\` : OK`);
}

await conn.end();
console.log('[migrate] Migration terminée.');
