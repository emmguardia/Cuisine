/**
 * 0005 — Synchronisation SumUp et HelloAsso.
 *
 *  external_transaction  chaque élément venu d'un fournisseur (vente, versement,
 *                        paiement…) n'est traité qu'une fois (clé unique)
 *  integration_state     curseur de reprise, verrou de synchronisation,
 *                        dernier succès / dernière erreur
 *
 * Les curseurs de départ reprennent là où s'arrête l'import manuel du
 * 16/10/2026 : rien de ce qui a déjà été saisi ne sera compté deux fois.
 */
import { sql } from 'kysely';

export async function up(db) {
  await sql`
    CREATE TABLE IF NOT EXISTS external_transaction (
      id          bigint unsigned NOT NULL AUTO_INCREMENT,
      provider    varchar(16)  NOT NULL,
      external_id varchar(100) NOT NULL,
      kind        varchar(16)  NOT NULL,
      occurred_at datetime(3),
      amount      int          NOT NULL DEFAULT 0,
      fee         int          NOT NULL DEFAULT 0,
      origin_id   varchar(36),
      created_at  datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      UNIQUE KEY external_transaction_unique (provider, external_id, kind),
      KEY external_transaction_origin_idx (origin_id),
      CONSTRAINT external_transaction_provider CHECK (provider IN ('sumup', 'helloasso'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS integration_state (
      provider        varchar(16)  NOT NULL,
      cursor_state    json         NOT NULL,
      lease_until     datetime(3),
      last_run_at     datetime(3),
      last_success_at datetime(3),
      last_error      varchar(500),
      last_error_at   datetime(3),
      last_result     json,
      PRIMARY KEY (provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`INSERT IGNORE INTO integration_state (provider, cursor_state) VALUES
    ('sumup',     ${JSON.stringify({ sales_after_day: '2026-10-16', payouts_after_day: '2026-10-10' })}),
    ('helloasso', ${JSON.stringify({ payments_after: '2026-10-16T11:07:00Z', cashouts_after_day: '2026-10-08' })})
  `.execute(db);

  // Remboursement d'un client : diminue les ventes (débit du compte de produits).
  await sql`INSERT IGNORE INTO category (id, direction, label, account_code, sort_order)
            VALUES ('remboursement_client', 'depense', 'Remboursement client', '7061', 185)`.execute(db);
}

export async function down(db) {
  await sql`DROP TABLE IF EXISTS integration_state`.execute(db);
  await sql`DROP TABLE IF EXISTS external_transaction`.execute(db);
  await sql`DELETE FROM category WHERE id = 'remboursement_client'`.execute(db);
}
