/**
 * 0004 — Catégories au vocabulaire du bureau, adhérents, événements.
 *
 *  category    groupe « rentrées / sorties » renommé, nouvelles catégories
 *  member      liste des adhérents (HelloAsso, SumUp, virement, espèces)
 *  event       ventes et événements (crêpes du vendredi…)
 *  event_link  opérations rattachées à un événement (montant affecté facultatif)
 *
 * Les événements ne sont pas de la comptabilité : ils regroupent des
 * opérations existantes pour mesurer la rentabilité, sans rien écrire en compta.
 */
import { sql } from 'kysely';

const RENAME = [
  ['cotisation',          'Adhésion',                          10],
  ['don',                 'Don',                               20],
  ['vente_repas',         'Paiement (ventes)',                 30],
  ['subvention',          'Subvention',                        40],
  ['evenement_recette',   'Prestation événement',              50],
  ['remboursement_frais', 'Crédit Mutuel (avoir)',             60],
  ['autre_recette',       'Autre recette',                     90],
  ['ingredients',         'Courses (alimentaire)',            110],
  ['consommables',        'Courses (consommables, entretien)',120],
  ['petit_materiel',      'Matériel (ustensiles)',            130],
  ['materiel',            'Matériel (plus de 500 €)',         140],
  ['frais_bancaires',     'Frais bancaires et commissions',   150],
  ['parts_sociales',      'Crédit Mutuel (parts sociales)',   170],
  ['evenement_depense',   'Dépense d\'événement',              180],
  ['autre_depense',       'Autre dépense',                    190],
];

export async function up(db) {
  for (const [id, label, order] of RENAME) {
    await sql`UPDATE category SET label = ${label}, sort_order = ${order} WHERE id = ${id}`.execute(db);
  }
  await sql`INSERT IGNORE INTO category (id, direction, label, account_code, sort_order)
            VALUES ('cotisation_banque', 'depense', 'Crédit Mutuel (cotisation)', '627', 160)`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS member (
      id            varchar(36)  NOT NULL,
      last_name     varchar(100) NOT NULL,
      first_name    varchar(100) NOT NULL,
      email         varchar(255),
      joined_on     date         NOT NULL,
      season        varchar(20)  NOT NULL,
      amount        int          NOT NULL DEFAULT 0,
      tarif         varchar(100),
      channel       varchar(16)  NOT NULL,
      helloasso_ref varchar(64),
      import_ref    varchar(120),
      notes         text,
      created_by    varchar(36),
      created_at    datetime(3)  NOT NULL DEFAULT NOW(3),
      updated_at    datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      UNIQUE KEY member_helloasso_unique (helloasso_ref),
      UNIQUE KEY member_import_ref_unique (import_ref),
      KEY member_season_idx (season),
      KEY member_name_idx (last_name, first_name),
      CONSTRAINT member_channel CHECK (channel IN ('helloasso', 'sumup', 'virement', 'especes', 'autre')),
      CONSTRAINT member_amount CHECK (amount >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS event (
      id          varchar(36)  NOT NULL,
      name        varchar(150) NOT NULL,
      date        date         NOT NULL,
      description text,
      import_ref  varchar(120),
      created_by  varchar(36),
      created_at  datetime(3)  NOT NULL DEFAULT NOW(3),
      updated_at  datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      UNIQUE KEY event_import_ref_unique (import_ref),
      KEY event_date_idx (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  // origin_id : la chaîne de versions d'une opération (survit aux corrections).
  await sql`
    CREATE TABLE IF NOT EXISTS event_link (
      event_id   varchar(36) NOT NULL,
      origin_id  varchar(36) NOT NULL,
      amount     int,
      created_by varchar(36),
      created_at datetime(3) NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (event_id, origin_id),
      KEY event_link_origin_idx (origin_id),
      CONSTRAINT event_link_event_fkey FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
      CONSTRAINT event_link_amount CHECK (amount IS NULL OR amount > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);
}

export async function down(db) {
  await sql`DROP TABLE IF EXISTS event_link`.execute(db);
  await sql`DROP TABLE IF EXISTS event`.execute(db);
  await sql`DROP TABLE IF EXISTS member`.execute(db);
  await sql`DELETE FROM category WHERE id = 'cotisation_banque'`.execute(db);
}
