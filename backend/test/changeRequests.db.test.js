/**
 * Double validation et journal d'audit, contre une vraie MariaDB.
 *
 * Ignoré si TEST_DB_HOST n'est pas défini. En local :
 *   docker run -d --name quisine-testdb -p 127.0.0.1:33306:3306 \
 *     -e MARIADB_ROOT_PASSWORD=rootpw -e MARIADB_DATABASE=quisine_test \
 *     -e MARIADB_USER=quisine_user -e MARIADB_PASSWORD=testpw mariadb:11.8
 *   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33306 TEST_DB_USER=quisine_user \
 *     TEST_DB_PASSWORD=testpw TEST_DB_NAME=quisine_test pnpm test
 *
 * ATTENTION : vide entièrement la base visée. Jamais sur une base réelle.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { dbEnabled as enabled, resetDatabase } from './helpers/db.js';

describe('double validation (base réelle)', { skip: !enabled && 'TEST_DB_HOST non défini' }, () => {
  let pool, svc;

  const A = { id: 'a0000000-0000-4000-8000-000000000001', name: 'Alice', email: 'alice@test.fr' };
  const B = { id: 'b0000000-0000-4000-8000-000000000002', name: 'Bruno', email: 'bruno@test.fr' };
  const C = { id: 'c0000000-0000-4000-8000-000000000003', name: 'Chloé', email: 'chloe@test.fr' };
  const M = { id: 'd0000000-0000-4000-8000-000000000004', name: 'Malik', email: 'malik@test.fr' };

  const resetDb = () => resetDatabase(pool);

  async function seed() {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['change_request', 'session', 'recipe', 'user', 'allowed_email']) {
      await pool.query(`DELETE FROM \`${t}\``);
    }
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    for (const [u, role] of [[A, 'admin'], [B, 'admin'], [C, 'admin'], [M, 'membre']]) {
      await pool.execute(
        'INSERT INTO `user` (id, name, email, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))',
        [u.id, u.name, u.email, role]
      );
      await pool.execute('INSERT INTO allowed_email (email, role) VALUES (?, ?)', [u.email, role]);
    }
  }

  const roleOf = async (id) => (await pool.execute('SELECT role FROM `user` WHERE id = ?', [id]))[0][0]?.role;
  const whitelistRole = async (email) =>
    (await pool.execute('SELECT role FROM allowed_email WHERE email = ?', [email]))[0][0]?.role;
  const statusOf = async (id) =>
    (await pool.execute('SELECT status FROM change_request WHERE id = ?', [id]))[0][0].status;

  before(async () => {
    const db = await import('../config/database.js');
    pool = db.getPool();
    await resetDb();
    svc = await import('../services/changeRequests.js');
    await import('../services/handlers/index.js');
  });

  after(async () => {
    await pool?.end();
  });

  test('un membre est promu admin seulement après validation par un autre admin', async () => {
    await seed();
    const r = await svc.createRequest({
      type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Nouveau trésorier', actor: A,
    });
    assert.equal(r.status, 'pending');
    assert.equal(await roleOf(M.id), 'membre', 'rien ne change avant validation');

    await assert.rejects(svc.approveRequest({ id: r.id, actor: A }), { status: 403 });

    const done = await svc.approveRequest({ id: r.id, actor: B, comment: 'OK' });
    assert.equal(done.status, 'approved');
    assert.equal(done.decided_by, B.id);
    assert.equal(await roleOf(M.id), 'admin');
    assert.equal(await whitelistRole(M.email), 'admin', 'la liste blanche suit, sinon la connexion suivante annulerait le changement');

    const [audits] = await pool.execute(
      'SELECT action FROM audit_log WHERE target_id = ? ORDER BY id', [M.id]
    );
    assert.deepEqual(audits.map(a => a.action), ['change_request.create', 'change_request.approve']);
  });

  test('une seule demande en attente par élément', async () => {
    await seed();
    await svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Première', actor: A });
    await assert.rejects(
      svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Doublon', actor: B }),
      { status: 409 }
    );
  });

  test('si l\'élément a changé depuis la demande, l\'approbation est refusée', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Promotion', actor: A });
    await pool.execute('UPDATE `user` SET name = ? WHERE id = ?', ['Malik R.', M.id]);
    await assert.rejects(svc.approveRequest({ id: r.id, actor: B }), { status: 409 });
    assert.equal(await statusOf(r.id), 'obsolete');
    assert.equal(await roleOf(M.id), 'membre');
  });

  test('rétrograder un admin coupe ses sessions', async () => {
    await seed();
    await pool.execute(
      `INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId)
       VALUES ('s1', NOW(3) + INTERVAL 1 DAY, 'tok-c', NOW(3), NOW(3), ?)`, [C.id]
    );
    const r = await svc.createRequest({ type: 'user.set_role', targetId: C.id, payload: { role: 'membre' }, reason: 'Fin de mandat', actor: A });
    await svc.approveRequest({ id: r.id, actor: B });
    assert.equal(await roleOf(C.id), 'membre');
    assert.equal(await whitelistRole(C.email), 'membre');
    const [sessions] = await pool.execute('SELECT id FROM session WHERE userId = ?', [C.id]);
    assert.equal(sessions.length, 0);
  });

  test('il reste toujours au moins 2 administrateurs', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'email.set_role', targetId: null, payload: {}, reason: 'x', actor: A })
      .catch(e => e);
    assert.equal(r.status, 400, 'payload invalide refusé');

    const [[c]] = await pool.execute('SELECT id FROM allowed_email WHERE email = ?', [C.email]);
    const first = await svc.createRequest({ type: 'email.delete_admin', targetId: String(c.id), payload: {}, reason: 'Départ de Chloé', actor: A });
    await svc.approveRequest({ id: first.id, actor: B });

    await assert.rejects(
      svc.createRequest({ type: 'user.set_role', targetId: B.id, payload: { role: 'membre' }, reason: 'Départ de Bruno', actor: A }),
      { status: 409 }
    );
  });

  test('on ne peut pas viser son propre rôle', async () => {
    await seed();
    await assert.rejects(
      svc.createRequest({ type: 'user.set_role', targetId: A.id, payload: { role: 'membre' }, reason: 'Je pars', actor: A }),
      { status: 400 }
    );
  });

  test('ajout d\'un email admin par double validation', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'email.add_admin', targetId: 'nouveau@test.fr', payload: {}, reason: 'Nouvelle présidente', actor: A });
    assert.equal(await whitelistRole('nouveau@test.fr'), undefined);
    await svc.approveRequest({ id: r.id, actor: C });
    assert.equal(await whitelistRole('nouveau@test.fr'), 'admin');

    await assert.rejects(
      svc.createRequest({ type: 'email.add_admin', targetId: 'PAS UN EMAIL', payload: {}, reason: 'Essai invalide', actor: A }),
      { status: 400 }
    );
  });

  test('refus, annulation : seules les bonnes personnes peuvent agir', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Promotion', actor: A });
    await assert.rejects(svc.rejectRequest({ id: r.id, actor: A }), { status: 403 });
    await assert.rejects(svc.cancelRequest({ id: r.id, actor: B }), { status: 403 });
    const rejected = await svc.rejectRequest({ id: r.id, actor: B, comment: 'Pas maintenant' });
    assert.equal(rejected.status, 'rejected');
    await assert.rejects(svc.approveRequest({ id: r.id, actor: C }), { status: 409 }, 'déjà traitée');
    assert.equal(await roleOf(M.id), 'membre');
  });

  test('une demande expirée ne peut plus être validée', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Promotion', actor: A });
    await pool.execute('UPDATE change_request SET expires_at = NOW(3) - INTERVAL 1 DAY WHERE id = ?', [r.id]);
    await assert.rejects(svc.approveRequest({ id: r.id, actor: B }), { status: 409 });
    assert.equal(await statusOf(r.id), 'expired');
  });

  test('la base refuse qu\'une demande soit tranchée par son auteur (CHECK)', async () => {
    await seed();
    const r = await svc.createRequest({ type: 'user.set_role', targetId: M.id, payload: { role: 'admin' }, reason: 'Promotion', actor: A });
    await assert.rejects(
      pool.execute(`UPDATE change_request SET status = 'approved', decided_by = ? WHERE id = ?`, [A.id, r.id])
    );
  });

  test('le journal d\'audit ne peut être ni modifié ni effacé (triggers)', async () => {
    await pool.execute(`INSERT INTO audit_log (action) VALUES ('test.immuable')`);
    await assert.rejects(pool.execute(`UPDATE audit_log SET action = 'falsifie'`), /ajout seul/);
    await assert.rejects(pool.execute('DELETE FROM audit_log'), /ajout seul/);
  });
});
