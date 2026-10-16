/**
 * 0003 — Comptabilité en partie double.
 *
 *  fiscal_year     exercices
 *  ledger_account  plan comptable (associatif simplifié)
 *  category        catégories proposées à la saisie → compte
 *  entry           pièce comptable (une opération)
 *  entry_line      lignes débit / crédit, en centimes
 *  attachment      justificatifs (tickets, factures), stockés en base
 *
 * Inaltérabilité, garantie par triggers :
 *  - une pièce ne se supprime jamais ; une correction = écriture inverse
 *    + nouvelle pièce (double validation) ;
 *  - montants, dates, comptes ne changent que dans les 16 min qui suivent la
 *    saisie (le service limite à 15 min et à l'auteur) ;
 *  - rien ne bouge dans un exercice clôturé ;
 *  - un justificatif ne se supprime ni ne se modifie (retrait = marquage).
 */
import { sql } from 'kysely';

const ACCOUNTS = [
  // code,   libellé,                                               type,       trésorerie
  ['271',  'Parts sociales bancaires',                            'asset',     0],
  ['2154', 'Matériel de cuisine',                                 'asset',     0],
  ['467',  'Membres — avances à rembourser',                      'third',     1],
  ['5112', 'SumUp — en attente de versement',                     'treasury',  1],
  ['5113', 'HelloAsso — en attente de versement',                 'treasury',  1],
  ['512',  'Banque Crédit Mutuel',                                'treasury',  1],
  ['530',  'Caisse',                                              'treasury',  1],
  ['601',  'Achats alimentaires (ingrédients, boissons)',         'expense',   0],
  ['6063', 'Petit matériel et ustensiles',                        'expense',   0],
  ['6068', 'Consommables et produits d\'entretien',              'expense',   0],
  ['6257', 'Réceptions et événements',                            'expense',   0],
  ['627',  'Frais bancaires et commissions',                      'expense',   0],
  ['658',  'Autres charges',                                      'expense',   0],
  ['7061', 'Ventes de repas et boissons',                         'revenue',   0],
  ['7062', 'Prestations événements',                              'revenue',   0],
  ['74',   'Subventions',                                         'revenue',   0],
  ['7541', 'Dons',                                                'revenue',   0],
  ['756',  'Cotisations',                                         'revenue',   0],
  ['758',  'Autres produits',                                     'revenue',   0],
];

const CATEGORIES = [
  // id,                   sens,       libellé,                                 compte
  ['vente_repas',          'recette',  'Vente de repas et boissons',             '7061'],
  ['evenement_recette',    'recette',  'Prestation événement',                   '7062'],
  ['cotisation',           'recette',  'Cotisation / adhésion',                  '756'],
  ['don',                  'recette',  'Don',                                    '7541'],
  ['subvention',           'recette',  'Subvention',                             '74'],
  ['remboursement_frais',  'recette',  'Remboursement de frais bancaires',       '627'],
  ['autre_recette',        'recette',  'Autre recette',                          '758'],
  ['ingredients',          'depense',  'Courses alimentaires',                   '601'],
  ['consommables',         'depense',  'Consommables et entretien',              '6068'],
  ['petit_materiel',       'depense',  'Petit matériel et ustensiles',           '6063'],
  ['materiel',             'depense',  'Matériel (plus de 500 €)',               '2154'],
  ['evenement_depense',    'depense',  'Dépense d\'événement',                    '6257'],
  ['frais_bancaires',      'depense',  'Frais bancaires',                        '627'],
  ['parts_sociales',       'depense',  'Parts sociales bancaires',               '271'],
  ['autre_depense',        'depense',  'Autre dépense',                          '658'],
];

const RESTRICTED_ENTRY_COLUMNS = [
  'fiscal_year_id', 'journal', 'seq', 'number', 'date', 'label', 'kind', 'treasury',
  'third_party', 'notes', 'created_by', 'created_at', 'import_ref', 'reverses_id', 'origin_id',
];

export async function up(db) {
  await sql`
    CREATE TABLE IF NOT EXISTS fiscal_year (
      id         varchar(36)  NOT NULL,
      code       varchar(10)  NOT NULL,
      label      varchar(100) NOT NULL,
      start_date date         NOT NULL,
      end_date   date         NOT NULL,
      status     varchar(10)  NOT NULL DEFAULT 'open',
      closed_at  datetime(3),
      closed_by  varchar(36),
      created_at datetime(3)  NOT NULL DEFAULT NOW(3),
      PRIMARY KEY (id),
      UNIQUE KEY fiscal_year_code_unique (code),
      CONSTRAINT fiscal_year_dates CHECK (end_date > start_date),
      CONSTRAINT fiscal_year_status CHECK (status IN ('open', 'closed'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS ledger_account (
      code        varchar(10)  NOT NULL,
      label       varchar(255) NOT NULL,
      type        varchar(10)  NOT NULL,
      is_treasury tinyint(1)   NOT NULL DEFAULT 0,
      active      tinyint(1)   NOT NULL DEFAULT 1,
      PRIMARY KEY (code),
      CONSTRAINT ledger_account_type CHECK (type IN ('asset', 'liability', 'equity', 'expense', 'revenue', 'treasury', 'third'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS category (
      id           varchar(50)  NOT NULL,
      direction    varchar(10)  NOT NULL,
      label        varchar(255) NOT NULL,
      account_code varchar(10)  NOT NULL,
      sort_order   int          NOT NULL DEFAULT 0,
      active       tinyint(1)   NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      CONSTRAINT category_account_fkey FOREIGN KEY (account_code) REFERENCES ledger_account(code),
      CONSTRAINT category_direction CHECK (direction IN ('recette', 'depense'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS entry (
      id              varchar(36)  NOT NULL,
      origin_id       varchar(36)  NOT NULL,
      fiscal_year_id  varchar(36)  NOT NULL,
      journal         varchar(4)   NOT NULL,
      seq             int          NOT NULL,
      number          varchar(30)  NOT NULL,
      date            date         NOT NULL,
      label           varchar(255) NOT NULL,
      kind            varchar(16)  NOT NULL,
      treasury        varchar(16),
      third_party     varchar(255),
      notes           text,
      status          varchar(10)  NOT NULL DEFAULT 'active',
      source          varchar(16)  NOT NULL DEFAULT 'manuel',
      import_ref      varchar(120),
      reverses_id     varchar(36),
      replaced_by_id  varchar(36),
      created_by      varchar(36),
      created_by_name varchar(255),
      created_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      updated_at      datetime(3)  NOT NULL DEFAULT NOW(3),
      version         int          NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY entry_number_unique (fiscal_year_id, journal, seq),
      UNIQUE KEY entry_import_ref_unique (import_ref),
      KEY entry_date_idx (date),
      KEY entry_origin_idx (origin_id),
      KEY entry_status_idx (status),
      CONSTRAINT entry_fiscal_year_fkey FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_year(id),
      CONSTRAINT entry_kind CHECK (kind IN ('recette', 'depense', 'virement', 'od', 'contrepassation')),
      CONSTRAINT entry_status CHECK (status IN ('active', 'cancelled', 'replaced'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS entry_line (
      id           bigint unsigned NOT NULL AUTO_INCREMENT,
      entry_id     varchar(36)     NOT NULL,
      account_code varchar(10)     NOT NULL,
      category_id  varchar(50),
      label        varchar(255),
      debit        bigint unsigned NOT NULL DEFAULT 0,
      credit       bigint unsigned NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY entry_line_entry_idx (entry_id),
      KEY entry_line_account_idx (account_code),
      CONSTRAINT entry_line_entry_fkey   FOREIGN KEY (entry_id)     REFERENCES entry(id),
      CONSTRAINT entry_line_account_fkey FOREIGN KEY (account_code) REFERENCES ledger_account(code),
      CONSTRAINT entry_line_one_side CHECK ((debit = 0) <> (credit = 0))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS attachment (
      id                varchar(36)  NOT NULL,
      origin_id         varchar(36)  NOT NULL,
      filename          varchar(255) NOT NULL,
      mime              varchar(100) NOT NULL,
      size              int          NOT NULL,
      sha256            char(64)     NOT NULL,
      data              mediumblob   NOT NULL,
      uploaded_by       varchar(36),
      uploaded_by_name  varchar(255),
      uploaded_at       datetime(3)  NOT NULL DEFAULT NOW(3),
      removed_at        datetime(3),
      removed_by        varchar(36),
      PRIMARY KEY (id),
      KEY attachment_origin_idx (origin_id),
      KEY attachment_sha_idx (sha256),
      CONSTRAINT attachment_mime CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);

  /* ── Triggers d'inaltérabilité ─────────────────────────────────────── */
  const changed = RESTRICTED_ENTRY_COLUMNS.map(c => `NOT (OLD.${c} <=> NEW.${c})`).join(' OR ');

  const triggers = {
    entry_no_delete: `
      CREATE TRIGGER entry_no_delete BEFORE DELETE ON entry FOR EACH ROW
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Une pièce comptable ne se supprime pas : passer une écriture inverse'`,
    entry_guard_update: `
      CREATE TRIGGER entry_guard_update BEFORE UPDATE ON entry FOR EACH ROW
      BEGIN
        IF (SELECT status FROM fiscal_year WHERE id = OLD.fiscal_year_id) = 'closed' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exercice clôturé : modification impossible';
        END IF;
        IF (${changed}) AND OLD.created_at < NOW(3) - INTERVAL 16 MINUTE THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pièce validée : modification par demande à double validation uniquement';
        END IF;
      END`,
    entry_guard_insert: `
      CREATE TRIGGER entry_guard_insert BEFORE INSERT ON entry FOR EACH ROW
      BEGIN
        IF (SELECT status FROM fiscal_year WHERE id = NEW.fiscal_year_id) <> 'open' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exercice clôturé : saisie impossible';
        END IF;
        IF NEW.date < (SELECT start_date FROM fiscal_year WHERE id = NEW.fiscal_year_id)
           OR NEW.date > (SELECT end_date FROM fiscal_year WHERE id = NEW.fiscal_year_id) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date hors de l''exercice';
        END IF;
      END`,
    entry_line_guard_insert: `
      CREATE TRIGGER entry_line_guard_insert BEFORE INSERT ON entry_line FOR EACH ROW
      BEGIN
        IF (SELECT created_at FROM entry WHERE id = NEW.entry_id) < NOW(3) - INTERVAL 16 MINUTE THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pièce validée : lignes non modifiables';
        END IF;
      END`,
    entry_line_guard_update: `
      CREATE TRIGGER entry_line_guard_update BEFORE UPDATE ON entry_line FOR EACH ROW
      BEGIN
        IF (SELECT created_at FROM entry WHERE id = OLD.entry_id) < NOW(3) - INTERVAL 16 MINUTE THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pièce validée : lignes non modifiables';
        END IF;
      END`,
    entry_line_guard_delete: `
      CREATE TRIGGER entry_line_guard_delete BEFORE DELETE ON entry_line FOR EACH ROW
      BEGIN
        IF (SELECT created_at FROM entry WHERE id = OLD.entry_id) < NOW(3) - INTERVAL 16 MINUTE THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pièce validée : lignes non modifiables';
        END IF;
      END`,
    attachment_no_delete: `
      CREATE TRIGGER attachment_no_delete BEFORE DELETE ON attachment FOR EACH ROW
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un justificatif ne se supprime pas : le retirer par demande'`,
    attachment_guard_update: `
      CREATE TRIGGER attachment_guard_update BEFORE UPDATE ON attachment FOR EACH ROW
      BEGIN
        IF NOT (OLD.data <=> NEW.data) OR NOT (OLD.sha256 <=> NEW.sha256) OR NOT (OLD.origin_id <=> NEW.origin_id)
           OR NOT (OLD.mime <=> NEW.mime) OR NOT (OLD.uploaded_at <=> NEW.uploaded_at) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un justificatif ne se modifie pas';
        END IF;
      END`,
  };
  for (const [name, ddl] of Object.entries(triggers)) {
    await sql.raw(`DROP TRIGGER IF EXISTS ${name}`).execute(db);
    await sql.raw(ddl).execute(db);
  }

  /* ── Données de référence ──────────────────────────────────────────── */
  for (const [code, label, type, isTreasury] of ACCOUNTS) {
    await sql`INSERT IGNORE INTO ledger_account (code, label, type, is_treasury)
              VALUES (${code}, ${label}, ${type}, ${isTreasury})`.execute(db);
  }
  let order = 0;
  for (const [id, direction, label, account] of CATEGORIES) {
    await sql`INSERT IGNORE INTO category (id, direction, label, account_code, sort_order)
              VALUES (${id}, ${direction}, ${label}, ${account}, ${order += 10})`.execute(db);
  }
  // Premier exercice : ouverture du compte bancaire (30/05/2026) → 31/08/2027,
  // puis exercices calés sur l'année scolaire.
  await sql`INSERT IGNORE INTO fiscal_year (id, code, label, start_date, end_date)
            VALUES ('9b2c1f4e-0a6d-4c3b-8e7f-2026a0000001', '2026', 'Exercice 2026-2027',
                    '2026-05-30', '2027-08-31')`.execute(db);
}

export async function down(db) {
  for (const t of ['attachment_guard_update', 'attachment_no_delete', 'entry_line_guard_delete',
    'entry_line_guard_update', 'entry_line_guard_insert', 'entry_guard_insert',
    'entry_guard_update', 'entry_no_delete']) {
    await sql.raw(`DROP TRIGGER IF EXISTS ${t}`).execute(db);
  }
  for (const t of ['attachment', 'entry_line', 'entry', 'category', 'ledger_account', 'fiscal_year']) {
    await sql.raw(`DROP TABLE IF EXISTS ${t}`).execute(db);
  }
}
