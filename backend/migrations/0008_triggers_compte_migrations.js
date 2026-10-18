/**
 * 0008 — Les triggers appartiennent au compte des migrations.
 *
 * MariaDB exécute un trigger avec les droits de son propriétaire (DEFINER), qui
 * doit garder le privilège TRIGGER. Les triggers créés avant 0008 l'ont été
 * avec le compte du backend : celui-ci ne pouvait donc pas perdre ce privilège,
 * qui lui permettrait aussi de les supprimer.
 *
 * Cette migration recrée à l'identique chaque trigger de la base dont le
 * propriétaire n'est pas le compte qui l'exécute (le compte des migrations en
 * production). Le backend peut ensuite être limité à SELECT, INSERT, UPDATE,
 * DELETE sans que les triggers cessent de fonctionner.
 */
import { sql } from 'kysely';

export async function up(db) {
  const { rows: [me] } = await sql`SELECT CURRENT_USER() AS u`.execute(db);
  const [user, host] = me.u.split('@');
  const definer = `${user}@${host}`;

  const { rows: triggers } = await sql`
    SELECT TRIGGER_NAME AS name, ACTION_TIMING AS timing, EVENT_MANIPULATION AS event,
           EVENT_OBJECT_TABLE AS tbl, ACTION_STATEMENT AS body, DEFINER AS definer
      FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()
  `.execute(db);

  for (const t of triggers) {
    if (t.definer === definer) continue;
    await sql.raw(`DROP TRIGGER IF EXISTS \`${t.name}\``).execute(db);
    await sql.raw(
      `CREATE DEFINER = CURRENT_USER TRIGGER \`${t.name}\` ${t.timing} ${t.event} ON \`${t.tbl}\` FOR EACH ROW ${t.body}`
    ).execute(db);
  }
}

// Rien à défaire : les triggers restent identiques, seul leur propriétaire change.
export async function down() {}
