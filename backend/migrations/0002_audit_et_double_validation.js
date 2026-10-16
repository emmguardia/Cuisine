/**
 * 0002 — Journal d'audit et demandes à double validation.
 *
 * audit_log : en ajout seul. Les triggers refusent toute modification ou
 * suppression, y compris depuis un client SQL avec les identifiants de l'app.
 *
 * change_request : une action sensible n'est appliquée qu'après l'accord d'un
 * autre membre du bureau. La contrainte CHECK interdit au niveau de la base
 * qu'une demande soit tranchée par son auteur.
 *
 * Pré-requis côté MariaDB : avec le binlog actif (Galera), créer un trigger
 * demande le privilège TRIGGER et, sans SUPER, log_bin_trust_function_creators=1.
 */
import { sql } from 'kysely';

export async function up(db) {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          bigint unsigned NOT NULL AUTO_INCREMENT,
      created_at  datetime(3)     NOT NULL DEFAULT NOW(3),
      actor_id    varchar(36),
      actor_email varchar(255),
      ip          varchar(64),
      action      varchar(100)    NOT NULL,
      target_type varchar(64),
      target_id   varchar(255),
      details     json,
      PRIMARY KEY (id),
      KEY audit_log_created_idx (created_at),
      KEY audit_log_target_idx (target_type, target_id),
      KEY audit_log_actor_idx (actor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS audit_log_no_update`.execute(db);
  await sql`
    CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log est en ajout seul'
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS audit_log_no_delete`.execute(db);
  await sql`
    CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log est en ajout seul'
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS change_request (
      id                varchar(36)  NOT NULL,
      type              varchar(64)  NOT NULL,
      target_type       varchar(64)  NOT NULL,
      target_id         varchar(255),
      target_label      varchar(255),
      target_hash       char(64),
      payload           json         NOT NULL,
      before_state      json,
      after_state       json,
      reason            text         NOT NULL,
      status            varchar(16)  NOT NULL DEFAULT 'pending',
      requested_by      varchar(36)  NOT NULL,
      requested_by_name varchar(255),
      requested_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      expires_at        datetime(3)  NOT NULL,
      decided_by        varchar(36),
      decided_by_name   varchar(255),
      decided_at        datetime(3),
      decision_comment  text,
      pending_key       varchar(330),
      PRIMARY KEY (id),
      UNIQUE KEY change_request_pending_unique (pending_key),
      KEY change_request_status_idx (status, requested_at),
      CONSTRAINT change_request_four_eyes
        CHECK (decided_by IS NULL OR decided_by <> requested_by),
      CONSTRAINT change_request_status_valid
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'obsolete'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);
}

export async function down(db) {
  await sql`DROP TABLE IF EXISTS change_request`.execute(db);
  await sql`DROP TRIGGER IF EXISTS audit_log_no_delete`.execute(db);
  await sql`DROP TRIGGER IF EXISTS audit_log_no_update`.execute(db);
  await sql`DROP TABLE IF EXISTS audit_log`.execute(db);
}
