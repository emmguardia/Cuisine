/**
 * 0006 — Équipe reliée aux adhérents, mail Guardia.
 *
 *  member.school_email    adresse @guardiaschool.fr (pré-remplie quand l'email
 *                         connu est déjà une adresse Guardia)
 *  team_member.member_id  la personne affichée sur /equipe est un adhérent ;
 *                         rattachement automatique quand le nom correspond
 */
import { sql } from 'kysely';

export async function up(db) {
  await sql`ALTER TABLE member
              ADD COLUMN IF NOT EXISTS school_email varchar(255) NULL AFTER email,
              ADD UNIQUE KEY IF NOT EXISTS member_school_email_unique (school_email)`.execute(db);
  await sql`UPDATE member SET school_email = LOWER(email)
             WHERE school_email IS NULL AND email LIKE '%@guardiaschool.fr'`.execute(db);

  await sql`ALTER TABLE team_member
              ADD COLUMN IF NOT EXISTS member_id varchar(36) NULL,
              ADD UNIQUE KEY IF NOT EXISTS team_member_member_unique (member_id),
              ADD CONSTRAINT team_member_member_fkey FOREIGN KEY IF NOT EXISTS (member_id)
                REFERENCES member(id) ON DELETE SET NULL`.execute(db);
  await sql`UPDATE team_member t
              JOIN member m ON LOWER(TRIM(t.name)) = LOWER(CONCAT(m.first_name, ' ', m.last_name))
               SET t.member_id = m.id
             WHERE t.member_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM (SELECT member_id FROM team_member) x WHERE x.member_id = m.id)`.execute(db);
}

export async function down(db) {
  await sql`ALTER TABLE team_member DROP FOREIGN KEY IF EXISTS team_member_member_fkey`.execute(db);
  await sql`ALTER TABLE team_member DROP INDEX IF EXISTS team_member_member_unique, DROP COLUMN IF EXISTS member_id`.execute(db);
  await sql`ALTER TABLE member DROP INDEX IF EXISTS member_school_email_unique, DROP COLUMN IF EXISTS school_email`.execute(db);
}
