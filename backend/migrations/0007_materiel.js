/**
 * 0007 — Matériel (ustensiles, équipements) et contrôles d'inventaire.
 *
 *  equipment             fiche : quantité attendue, état, provenance (achat / don)
 *  equipment_photo       photo de la fiche (en base, comme les justificatifs)
 *  equipment_movement    journal des mouvements (ajout, perte, casse…), en ajout seul
 *  inventory_check       contrôle d'inventaire daté
 *  inventory_check_line  quantité attendue / comptée, et ce qu'on décide des écarts
 *
 * La quantité attendue est la somme des mouvements ; la colonne expected_qty
 * n'en est que le cache, tenu à jour dans la même transaction.
 */
import { sql } from 'kysely';

export async function up(db) {
  await sql`
    CREATE TABLE IF NOT EXISTS equipment (
      id              varchar(36)  NOT NULL,
      name            varchar(150) NOT NULL,
      category        varchar(30)  NOT NULL,
      expected_qty    int          NOT NULL DEFAULT 0,
      item_condition  varchar(10)  NOT NULL DEFAULT 'bon',
      provenance      varchar(10)  NOT NULL DEFAULT 'achat',
      purchase_date   date,
      unit_price      int,
      donor           varchar(150),
      donated_value   int,
      entry_origin_id varchar(36),
      notes           text,
      status          varchar(10)  NOT NULL DEFAULT 'actif',
      exit_reason     varchar(10),
      exit_date       date,
      created_by      varchar(36),
      created_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      updated_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      KEY equipment_category_idx (category),
      KEY equipment_status_idx (status),
      CONSTRAINT equipment_qty CHECK (expected_qty >= 0),
      CONSTRAINT equipment_condition CHECK (item_condition IN ('neuf', 'bon', 'use', 'hs')),
      CONSTRAINT equipment_provenance CHECK (provenance IN ('achat', 'don')),
      CONSTRAINT equipment_status CHECK (status IN ('actif', 'sorti')),
      CONSTRAINT equipment_exit CHECK (exit_reason IS NULL OR exit_reason IN ('perdu', 'casse', 'jete', 'donne'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS equipment_photo (
      equipment_id varchar(36) NOT NULL,
      mime         varchar(30) NOT NULL,
      size         int         NOT NULL,
      data         mediumblob  NOT NULL,
      updated_at   datetime(3) NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (equipment_id),
      CONSTRAINT equipment_photo_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      CONSTRAINT equipment_photo_mime CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS inventory_check (
      id                varchar(36)  NOT NULL,
      check_date        date         NOT NULL,
      status            varchar(10)  NOT NULL DEFAULT 'en_cours',
      notes             text,
      created_by        varchar(36),
      created_by_name   varchar(255),
      created_at        datetime(3)  NOT NULL DEFAULT NOW(3),
      validated_by      varchar(36),
      validated_by_name varchar(255),
      validated_at      datetime(3),
      PRIMARY KEY (id),
      KEY inventory_check_date_idx (check_date),
      CONSTRAINT inventory_check_status CHECK (status IN ('en_cours', 'valide', 'abandonne'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS inventory_check_line (
      check_id     varchar(36) NOT NULL,
      equipment_id varchar(36) NOT NULL,
      expected_qty int         NOT NULL,
      counted_qty  int,
      resolution   varchar(12),
      counted_by   varchar(255),
      counted_at   datetime(3),
      PRIMARY KEY (check_id, equipment_id),
      CONSTRAINT inventory_line_check_fkey FOREIGN KEY (check_id) REFERENCES inventory_check(id),
      CONSTRAINT inventory_line_equipment_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      CONSTRAINT inventory_line_counted CHECK (counted_qty IS NULL OR counted_qty >= 0),
      CONSTRAINT inventory_line_resolution CHECK (resolution IS NULL OR resolution IN ('perdu', 'casse', 'retrouve', 'a_recompter'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS equipment_movement (
      id              bigint unsigned NOT NULL AUTO_INCREMENT,
      equipment_id    varchar(36)  NOT NULL,
      kind            varchar(12)  NOT NULL,
      qty_delta       int          NOT NULL,
      reason          varchar(500),
      check_id        varchar(36),
      request_id      varchar(36),
      created_by      varchar(36),
      created_by_name varchar(255),
      created_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      KEY equipment_movement_item_idx (equipment_id, created_at),
      CONSTRAINT equipment_movement_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      CONSTRAINT equipment_movement_kind CHECK (kind IN ('ajout', 'achat', 'don', 'perte', 'casse', 'rebut', 'retrouve', 'correction', 'sortie'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  // Journal des mouvements en ajout seul : l'historique d'une perte ne s'efface pas.
  for (const [name, ev] of [['equipment_movement_no_update', 'UPDATE'], ['equipment_movement_no_delete', 'DELETE']]) {
    await sql.raw(`DROP TRIGGER IF EXISTS ${name}`).execute(db);
    await sql.raw(`CREATE TRIGGER ${name} BEFORE ${ev} ON equipment_movement FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Le journal du matériel est en ajout seul'`).execute(db);
  }
  // Une fiche ne se supprime pas : elle sort de l'inventaire (statut « sorti »).
  await sql.raw('DROP TRIGGER IF EXISTS equipment_no_delete').execute(db);
  await sql.raw(`CREATE TRIGGER equipment_no_delete BEFORE DELETE ON equipment FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Une fiche matériel ne se supprime pas : la sortir de l''inventaire'`).execute(db);
}

export async function down(db) {
  for (const t of ['equipment_no_delete', 'equipment_movement_no_delete', 'equipment_movement_no_update']) {
    await sql.raw(`DROP TRIGGER IF EXISTS ${t}`).execute(db);
  }
  for (const t of ['equipment_movement', 'inventory_check_line', 'inventory_check', 'equipment_photo', 'equipment']) {
    await sql.raw(`DROP TABLE IF EXISTS ${t}`).execute(db);
  }
}
