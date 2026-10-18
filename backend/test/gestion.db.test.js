/**
 * Adhérents, événements (rentabilité) et import de lot complet, contre MariaDB.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dbEnabled, resetDatabase, seedUsers, USERS } from './helpers/db.js';

const { A, B } = USERS;

describe('adhérents et événements (base réelle)', { skip: !dbEnabled && 'TEST_DB_HOST non défini' }, () => {
  let pool, db, compta, members, events, requests;
  const tx = (fn) => db.withTransaction(fn);

  before(async () => {
    db = await import('../config/database.js');
    pool = db.getPool();
    await resetDatabase(pool);
    await seedUsers(pool);
    compta = await import('../services/compta.js');
    members = await import('../services/members.js');
    events = await import('../services/events.js');
    requests = await import('../services/changeRequests.js');
    await import('../services/handlers/index.js');
  });
  after(async () => { await pool?.end(); });

  test('adhérents : ajout, modification, recherche, suppression', async () => {
    const m = members.MemberInput.parse({
      last_name: 'Popa', first_name: 'Serban', email: ' Serban@Example.fr ', joined_on: '2026-09-25',
      season: '2026-2027', amount: 700, tarif: 'Etudiant Quest', channel: 'helloasso',
    });
    assert.equal(m.email, 'serban@example.fr');
    const id = await tx(c => members.createMember(c, m, A));
    await tx(c => members.updateMember(c, id, { ...m, channel: 'sumup' }, A));
    const { members: list } = await members.listMembers({ q: 'serb' });
    assert.equal(list.length, 1);
    assert.equal(list[0].channel, 'sumup');
    assert.throws(() => members.MemberInput.parse({ ...m, channel: 'bitcoin' }));
    await tx(c => members.deleteMember(c, id, A));
    assert.equal((await members.listMembers()).members.length, 0);
  });

  test('événement : recettes - dépenses, montant partiel, correction et annulation suivies', async () => {
    const op = (o) => compta.OperationInput.parse({ date: '2026-10-09', ...o });
    const courses = await tx(c => compta.createEntry(c, op({ kind: 'depense', label: 'Courses', treasury: 'banque',
      lines: [{ category: 'ingredients', amount: 1500 }] }), A));
    const mixte = await tx(c => compta.createEntry(c, op({ kind: 'depense', label: 'Courses mixtes', treasury: 'banque',
      lines: [{ category: 'ingredients', amount: 1000 }] }), A));
    const ventes = await tx(c => compta.createEntry(c, op({ kind: 'recette', label: 'Ventes crêpes', treasury: 'sumup',
      lines: [{ category: 'vente_repas', amount: 3000 }] }), A));

    const evId = await tx(c => events.createEvent(c, { name: 'Crêpes', date: '2026-10-09', description: null }, A));
    await tx(c => events.linkEntry(c, evId, { entry_id: courses.id }, A));
    await tx(c => events.linkEntry(c, evId, { entry_id: mixte.id, amount: 400 }, A));
    await tx(c => events.linkEntry(c, evId, { entry_id: ventes.id }, A));
    await assert.rejects(tx(c => events.linkEntry(c, evId, { entry_id: ventes.id }, A)), { status: 409 });
    const autre = await tx(c => events.createEvent(c, { name: 'Autre', date: '2026-10-10', description: null }, A));
    await assert.rejects(tx(c => events.linkEntry(c, autre, { entry_id: mixte.id, amount: 5000 }, B)), { status: 400 });
    await tx(c => events.deleteEvent(c, autre, A));

    let ev = await events.getEvent(evId);
    assert.deepEqual([ev.recettes, ev.depenses, ev.resultat], [3000, 1900, 1100]);

    // Correction des ventes (double validation) : l'événement suit la nouvelle version.
    await pool.execute('UPDATE entry SET created_at = NOW(3) - INTERVAL 30 MINUTE WHERE id = ?', [ventes.id]);
    const r = await requests.createRequest({ type: 'entry.update', targetId: ventes.id, reason: 'Montant',
      payload: op({ kind: 'recette', label: 'Ventes crêpes', treasury: 'sumup', lines: [{ category: 'vente_repas', amount: 3200 }] }), actor: A });
    await requests.approveRequest({ id: r.id, actor: B });
    ev = await events.getEvent(evId);
    assert.equal(ev.recettes, 3200);
    assert.equal(ev.operations.length, 3);

    // Annulation des courses : elles ne comptent plus.
    const c2 = await requests.createRequest({ type: 'entry.cancel', targetId: courses.id, payload: {}, reason: 'Doublon', actor: A });
    await requests.approveRequest({ id: c2.id, actor: B });
    ev = await events.getEvent(evId);
    assert.equal(ev.depenses, 400);
    assert.equal(ev.operations.find(o => o.origin_id === courses.id).counted, false);

    await tx(c => events.unlinkEntry(c, evId, mixte.id, A));
    assert.equal((await events.getEvent(evId)).depenses, 0);
    assert.equal((await events.listEvents())[0].recettes, 3200);
  });

  test('lot complet : opérations, adhérents, événement liés ; réimport sans doublon', async () => {
    const lot = compta.LotInput.parse({
      format: 'quisine-lot', version: 1, label: 'Lot test',
      operations: [
        { ref: 'op-gaufres-courses', operation: { kind: 'depense', date: '2026-10-15', label: 'Courses gaufres',
          treasury: 'banque', lines: [{ category: 'ingredients', amount: 682 }] } },
        { ref: 'op-gaufres-ventes', operation: { kind: 'recette', date: '2026-10-16', label: 'Ventes gaufres',
          treasury: 'sumup', lines: [{ category: 'vente_repas', amount: 3520 }] } },
      ],
      members: [{ ref: 'adh-milhoud', member: { last_name: 'Milhoud', first_name: 'Lucas', email: null,
        joined_on: '2026-10-16', season: '2026-2027', amount: 700, tarif: 'Etudiant Quest', channel: 'helloasso' } }],
      events: [{ ref: 'ev-gaufres', event: { name: 'Gaufres', date: '2026-10-16' },
        operations: [{ ref: 'op-gaufres-courses', amount: 600 }, { ref: 'op-gaufres-ventes' }] }],
    });
    const preview = await tx(c => compta.importLot(c, lot, A, { dryRun: true }));
    assert.equal(preview.members[0].status, 'a_importer');
    await tx(c => compta.importLot(c, lot, A));
    const again = await tx(c => compta.importLot(c, lot, A));
    assert.deepEqual([again.members[0].status, again.events[0].status], ['deja_importee', 'deja_importee']);

    const ev = (await events.listEvents()).find(e => e.name === 'Gaufres');
    assert.deepEqual([ev.recettes, ev.depenses, ev.resultat], [3520, 600, 2920]);
    assert.equal((await members.listMembers({ q: 'milhoud' })).members.length, 1);

    const bad = structuredClone(lot);
    bad.events[0].ref = 'ev-autre';
    bad.events[0].operations = [{ ref: 'inexistante' }];
    await assert.rejects(tx(c => compta.importLot(c, bad, A, { dryRun: true })), { status: 400 });
  });

  test('filtre « remboursements de membres »', async () => {
    const op = compta.OperationInput.parse({ kind: 'virement', date: '2026-10-20', label: 'Remboursement Damien',
      from: 'banque', to: 'membre', third_party: 'Damien', amount: 100 });
    await tx(c => compta.createEntry(c, compta.OperationInput.parse({ kind: 'depense', date: '2026-10-19', label: 'Avance',
      treasury: 'membre', third_party: 'Damien', lines: [{ category: 'ingredients', amount: 100 }] }), A));
    await tx(c => compta.createEntry(c, op, A));
    const list = await compta.listOperations({ category: 'remboursement_membre' });
    assert.deepEqual(list.map(o => o.label), ['Remboursement Damien']);

    // Note de frais : avances et remboursements regroupés par membre (casse ignorée).
    await tx(c => compta.createEntry(c, compta.OperationInput.parse({ kind: 'depense', date: '2026-10-21', label: 'Avance 2',
      treasury: 'membre', third_party: 'damien ', lines: [{ category: 'consommables', amount: 250 }] }), A));
    const [d] = await compta.memberDebts({ membre: 'DAMIEN' });
    assert.deepEqual([d.avances.length, d.avance, d.rembourse, d.du], [2, 350, 100, 250]);
    assert.equal(d.avances[0].categories, 'Courses (alimentaire)');
    assert.deepEqual(await compta.memberDebts({ membre: 'personne' }), []);
  });
});
