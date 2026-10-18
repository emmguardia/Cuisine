/**
 * Matériel contre MariaDB : fiches, quantités par double validation,
 * contrôle d'inventaire, journal en ajout seul, sortie d'inventaire.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dbEnabled, resetDatabase, seedUsers, USERS } from './helpers/db.js';

const { A, B } = USERS;

describe('matériel (base réelle)', { skip: !dbEnabled && 'TEST_DB_HOST non défini' }, () => {
  let pool, db, eq, requests;
  const tx = (fn) => db.withTransaction(fn);
  const qty = async (id) => Number((await pool.execute('SELECT expected_qty q FROM equipment WHERE id = ?', [id]))[0][0].q);
  const item = (over = {}) => eq.NewEquipmentInput.parse({ name: 'Fouet inox', category: 'ustensiles', quantity: 3, ...over });

  before(async () => {
    db = await import('../config/database.js');
    pool = db.getPool();
    await resetDatabase(pool);
    await seedUsers(pool);
    eq = await import('../services/equipment.js');
    requests = await import('../services/changeRequests.js');
    await import('../services/handlers/index.js');
  });
  after(async () => { await pool?.end(); });

  test('création, informations modifiables, quantité via mouvements', async () => {
    const id = await tx(c => eq.createEquipment(c, item({ provenance: 'don', donor: 'Mme Popa' }), A));
    assert.equal(await qty(id), 3);
    await tx(c => eq.updateEquipment(c, id, eq.EquipmentInput.parse({ name: 'Fouet inox 31 cm', category: 'ustensiles', item_condition: 'use' }), A));
    const f = await eq.getEquipment(id);
    assert.equal(f.name, 'Fouet inox 31 cm');
    assert.deepEqual(f.movements.map(m => [m.kind, m.qty_delta]), [['don', 3]]);
  });

  test('changer une quantité passe par une demande validée par un autre', async () => {
    const id = await tx(c => eq.createEquipment(c, item({ name: 'Louche' }), A));
    await assert.rejects(
      requests.createRequest({ type: 'equipment.adjust', targetId: id, payload: { kind: 'perte', delta: 2 }, reason: 'Signe faux', actor: A }),
      { status: 400 }
    );
    const r = await requests.createRequest({ type: 'equipment.adjust', targetId: id, payload: { kind: 'casse', delta: -1 }, reason: 'Tombée', actor: A });
    assert.equal(r.after.quantite, 2);
    await assert.rejects(requests.approveRequest({ id: r.id, actor: A }), { status: 403 });
    await requests.approveRequest({ id: r.id, actor: B });
    assert.equal(await qty(id), 2);
    const f = await eq.getEquipment(id);
    assert.equal(f.movements[0].reason, 'Tombée', 'le motif de la demande est repris dans le journal');
  });

  test('contrôle d\'inventaire : écarts, décisions obligatoires, mouvements appliqués', async () => {
    const a = await tx(c => eq.createEquipment(c, item({ name: 'Couteau chef', category: 'couteaux', quantity: 4 }), A));
    const b = await tx(c => eq.createEquipment(c, item({ name: 'Saladier', category: 'vaisselle', quantity: 2 }), A));
    const checkId = await tx(c => eq.startCheck(c, '2026-10-18', A));
    await assert.rejects(tx(c => eq.startCheck(c, '2026-10-18', A)), { status: 409 });

    const lines = (await eq.getCheck(checkId)).lines;
    for (const l of lines) {
      const counted = l.equipment_id === a ? 3 : l.equipment_id === b ? 3 : Number(l.expected_qty);
      await tx(c => eq.setCheckLine(c, checkId, l.equipment_id, { counted_qty: counted }, B));
    }
    await assert.rejects(tx(c => eq.validateCheck(c, checkId, B)), /Décision manquante/);

    await tx(c => eq.setCheckLine(c, checkId, a, { counted_qty: 3, resolution: 'perdu' }, B));
    await tx(c => eq.setCheckLine(c, checkId, b, { counted_qty: 3, resolution: 'retrouve' }, B));
    assert.equal(await tx(c => eq.validateCheck(c, checkId, B)), 2);
    assert.deepEqual([await qty(a), await qty(b)], [3, 3]);
    const s = await eq.equipmentSummary();
    assert.equal(s.manquants_dernier_controle, 1);
    assert.equal(s.dernier_controle, '2026-10-18');
    await assert.rejects(tx(c => eq.setCheckLine(c, checkId, a, { counted_qty: 1 }, B)), { status: 409 });
  });

  test('sortie d\'inventaire par demande ; ni fiche ni journal ne s\'effacent', async () => {
    const id = await tx(c => eq.createEquipment(c, item({ name: 'Mixeur', category: 'electromenager', quantity: 1 }), A));
    const r = await requests.createRequest({ type: 'equipment.retire', targetId: id, payload: { exit_reason: 'casse' }, reason: 'Moteur grillé', actor: A });
    await requests.approveRequest({ id: r.id, actor: B });
    const f = await eq.getEquipment(id);
    assert.deepEqual([f.status, f.exit_reason, f.expected_qty], ['sorti', 'casse', 0]);
    assert.equal((await eq.listEquipment()).some(x => x.id === id), false);
    await assert.rejects(pool.execute('DELETE FROM equipment WHERE id = ?', [id]), /ne se supprime pas/);
    await assert.rejects(pool.execute('DELETE FROM equipment_movement WHERE equipment_id = ?', [id]), /ajout seul/);
    await assert.rejects(pool.execute('UPDATE equipment_movement SET qty_delta = 5 WHERE equipment_id = ?', [id]), /ajout seul/);
  });

  test('photo : type vérifié sur les octets', async () => {
    const id = await tx(c => eq.createEquipment(c, item({ name: 'Poêle' , category: 'cuisson' }), A));
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
    await assert.rejects(tx(c => eq.setPhoto(c, id, Buffer.from('%PDF-1.4 fake pdf content'), 'image/png', A)), { status: 415 });
    await assert.rejects(tx(c => eq.setPhoto(c, id, [0x89, 0x50], 'image/png', A)), { status: 415 });
    await tx(c => eq.setPhoto(c, id, png, 'image/png', A));
    assert.equal((await eq.getPhoto(id)).mime, 'image/png');
  });
});
