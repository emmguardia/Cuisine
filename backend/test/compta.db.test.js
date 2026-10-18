/**
 * Comptabilité contre une vraie MariaDB : équilibre des écritures,
 * numérotation, caisse, corrections, triggers d'inaltérabilité,
 * justificatifs, import de lot.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dbEnabled, resetDatabase, seedUsers, USERS } from './helpers/db.js';

const { A, B } = USERS;

const PDF  = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const PNG  = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const FAKE = Buffer.from('<script>alert(1)</script> pas une image');

describe('compta (base réelle)', { skip: !dbEnabled && 'TEST_DB_HOST non défini' }, () => {
  let pool, db, compta, requests;

  const tx = (fn) => db.withTransaction(fn);
  const balance = async (account) => Number((await pool.execute(
    `SELECT COALESCE(SUM(CAST(debit AS SIGNED) - CAST(credit AS SIGNED)), 0) AS s FROM entry_line WHERE account_code = ?`,
    [account]))[0][0].s);
  const age = (id, minutes) => pool.execute(
    'UPDATE entry SET created_at = NOW(3) - INTERVAL ? MINUTE WHERE id = ?', [minutes, id]);

  const depense = (over = {}) => ({
    kind: 'depense', date: '2026-10-15', label: 'Courses Lidl', treasury: 'banque',
    lines: [{ category: 'ingredients', amount: 1078 }, { category: 'consommables', amount: 458 }], ...over,
  });

  before(async () => {
    db = await import('../config/database.js');
    pool = db.getPool();
    await resetDatabase(pool);
    await seedUsers(pool);
    compta = await import('../services/compta.js');
    requests = await import('../services/changeRequests.js');
    await import('../services/handlers/index.js');
  });

  after(async () => { await pool?.end(); });

  test('une dépense ventilée produit une pièce équilibrée et numérotée', async () => {
    const op = compta.OperationInput.parse(depense());
    const { id, number } = await tx(c => compta.createEntry(c, op, A));
    assert.equal(number, 'BQ-2026-0001');

    const [lines] = await pool.execute('SELECT account_code, debit, credit FROM entry_line WHERE entry_id = ? ORDER BY id', [id]);
    assert.deepEqual(lines.map(l => [l.account_code, Number(l.debit), Number(l.credit)]), [
      ['512', 0, 1536], ['601', 1078, 0], ['6068', 458, 0],
    ]);
    assert.equal(await balance('512'), -1536);

    const back = await compta.getOperation(id);
    assert.deepEqual(back.operation.lines.map(l => l.amount), [1078, 458]);
  });

  test('catégorie de recette sur une dépense : refusée', async () => {
    const op = compta.OperationInput.parse(depense({ lines: [{ category: 'cotisation', amount: 700 }] }));
    await assert.rejects(tx(c => compta.createEntry(c, op, A)), { status: 400 });
  });

  test('date hors exercice : refusée', async () => {
    const op = compta.OperationInput.parse(depense({ date: '2026-01-10' }));
    await assert.rejects(tx(c => compta.createEntry(c, op, A)), { status: 400 });
  });

  test('la caisse ne peut pas devenir négative', async () => {
    const entree = compta.OperationInput.parse({
      kind: 'recette', date: '2026-10-08', label: 'Vente crêpes', treasury: 'caisse',
      lines: [{ category: 'vente_repas', amount: 2000 }],
    });
    await tx(c => compta.createEntry(c, entree, A));
    const sortie = compta.OperationInput.parse({
      kind: 'depense', date: '2026-10-09', label: 'Achat', treasury: 'caisse',
      lines: [{ category: 'ingredients', amount: 2500 }],
    });
    await assert.rejects(tx(c => compta.createEntry(c, sortie, A)), { status: 400 });
    assert.equal(await balance('530'), 2000);

    const depot = compta.OperationInput.parse({
      kind: 'virement', date: '2026-10-10', label: 'Dépôt en banque', from: 'caisse', to: 'banque', amount: 2000,
    });
    await tx(c => compta.createEntry(c, depot, A));
    assert.equal(await balance('530'), 0);
  });

  test('correction directe : auteur seulement, et dans les 15 minutes', async () => {
    const { id } = await tx(c => compta.createEntry(c, compta.OperationInput.parse(depense({ date: '2026-10-11' })), A));
    const fixed = compta.OperationInput.parse(depense({ date: '2026-10-11', label: 'Courses Lidl (corrigé)' }));

    await assert.rejects(tx(c => compta.selfCorrect(c, id, fixed, B)), { code: 'REQUEST_REQUIRED' });
    await tx(c => compta.selfCorrect(c, id, fixed, A));
    assert.equal((await compta.getOperation(id)).label, 'Courses Lidl (corrigé)');

    await age(id, 20);
    await assert.rejects(tx(c => compta.selfCorrect(c, id, fixed, A)), { code: 'REQUEST_REQUIRED' });
  });

  test('après 16 minutes, la base refuse toute modification ou suppression (triggers)', async () => {
    const { id } = await tx(c => compta.createEntry(c, compta.OperationInput.parse(depense({ date: '2026-10-12' })), A));
    await age(id, 20);
    await assert.rejects(pool.execute(`UPDATE entry SET label = 'falsifié' WHERE id = ?`, [id]), /double validation/);
    await assert.rejects(pool.execute('UPDATE entry_line SET debit = 1 WHERE entry_id = ? AND debit > 0', [id]), /non modifiables/);
    await assert.rejects(pool.execute('DELETE FROM entry_line WHERE entry_id = ?', [id]), /non modifiables/);
    await assert.rejects(pool.execute('DELETE FROM entry WHERE id = ?', [id]), /ne se supprime pas/);
    await assert.rejects(pool.execute(
      `INSERT INTO entry_line (entry_id, account_code, debit, credit) VALUES (?, '601', 100, 0)`, [id]), /non modifiables/);
  });

  test('correction par double validation : écriture inverse + nouvelle version', async () => {
    const before = await balance('512');
    const { id } = await tx(c => compta.createEntry(c, compta.OperationInput.parse(depense({ date: '2026-10-13' })), A));
    await age(id, 30);

    const r = await requests.createRequest({
      type: 'entry.update', targetId: id, reason: 'Montant faux',
      payload: depense({ date: '2026-10-13', lines: [{ category: 'ingredients', amount: 1000 }] }), actor: A,
    });
    assert.equal(r.before.montant, '15,36 €');
    assert.equal(r.after.montant, '10,00 €');
    await assert.rejects(requests.approveRequest({ id: r.id, actor: A }), { status: 403 });
    await requests.approveRequest({ id: r.id, actor: B });

    const original = await compta.getOperation(id);
    assert.equal(original.status, 'replaced');
    assert.deepEqual(original.history.map(h => h.kind), ['depense', 'contrepassation', 'depense']);
    assert.equal(await balance('512'), before - 1000, 'seule la nouvelle version compte');

    const list = await compta.listOperations({ from: '2026-10-13', to: '2026-10-13' });
    assert.equal(list.length, 1);
    assert.equal(list[0].total, 1000);
  });

  test('annulation par double validation', async () => {
    const before = await balance('512');
    const { id } = await tx(c => compta.createEntry(c, compta.OperationInput.parse(depense({ date: '2026-10-14' })), A));
    const r = await requests.createRequest({ type: 'entry.cancel', targetId: id, payload: {}, reason: 'Doublon', actor: A });
    await requests.approveRequest({ id: r.id, actor: B });
    assert.equal((await compta.getOperation(id)).status, 'cancelled');
    assert.equal(await balance('512'), before);
  });

  test('justificatifs : type vérifié sur les octets, doublon refusé, retrait par demande', async () => {
    const { id } = await tx(c => compta.createEntry(c, compta.OperationInput.parse(depense({ date: '2026-10-16' })), A));

    await assert.rejects(tx(c => compta.addAttachment(c, id, { filename: 'x.jpg', buffer: FAKE, declaredMime: 'image/jpeg' }, A)), { status: 415 });
    // Corps falsifié : chaîne, ou objet imitant un fichier avec une « length » choisie.
    await assert.rejects(tx(c => compta.addAttachment(c, id, { filename: 'x.pdf', buffer: '%PDF-1.4 texte', declaredMime: 'application/pdf' }, A)), { status: 415 });
    await assert.rejects(tx(c => compta.addAttachment(c, id, { filename: 'x.pdf', buffer: { length: 3, 0: 37 }, declaredMime: 'application/pdf' }, A)), { status: 415 });
    await assert.rejects(tx(c => compta.addAttachment(c, id, { filename: 'x.png', buffer: PDF, declaredMime: 'image/png' }, A)), { status: 415 });

    const a = await tx(c => compta.addAttachment(c, id, { filename: '../../etc/ticket "lidl".pdf', buffer: PDF, declaredMime: 'application/pdf' }, A));
    assert.equal(a.filename, 'ticket lidl.pdf');
    await assert.rejects(tx(c => compta.addAttachment(c, id, { filename: 'bis.pdf', buffer: PDF }, A)), { status: 409 });
    await tx(c => compta.addAttachment(c, id, { filename: 'photo.png', buffer: PNG }, A));

    assert.equal((await compta.getAttachment(a.id)).data.equals(PDF), true);
    await assert.rejects(pool.execute('DELETE FROM attachment WHERE id = ?', [a.id]), /ne se supprime pas/);
    await assert.rejects(pool.execute(`UPDATE attachment SET data = 'x' WHERE id = ?`, [a.id]), /ne se modifie pas/);

    const r = await requests.createRequest({ type: 'attachment.remove', targetId: a.id, payload: {}, reason: 'Mauvais ticket', actor: A });
    await requests.approveRequest({ id: r.id, actor: B });
    assert.equal((await compta.getOperation(id)).attachments.length, 1);
  });

  test('import de lot : aperçu, import, réimport sans doublon', async () => {
    const lot = compta.LotInput.parse({
      format: 'quisine-lot', version: 1, label: 'Reprise test',
      operations: [
        { ref: 'cm-2026-06-04-subvention', operation: {
          kind: 'recette', date: '2026-06-04', label: 'Subvention Quest Education', treasury: 'banque',
          lines: [{ category: 'subvention', amount: 20000 }] } },
        { ref: 'ticket-2026-10-08-lidl', operation: {
          kind: 'depense', date: '2026-10-08', label: 'Lidl', treasury: 'banque',
          lines: [{ category: 'ingredients', amount: 264 }] },
          attachments: [{ filename: 'lidl.pdf', mime: 'application/pdf', data: PDF.toString('base64') }] },
      ],
    });

    const preview = await tx(c => compta.importLot(c, lot, A, { dryRun: true }));
    assert.deepEqual(preview.operations.map(o => o.status), ['a_importer', 'a_importer']);
    const [[{ n }]] = await pool.execute(`SELECT COUNT(*) AS n FROM entry WHERE source = 'import'`);
    assert.equal(Number(n), 0, 'l\'aperçu n\'écrit rien');

    const done = await tx(c => compta.importLot(c, lot, A));
    assert.deepEqual(done.operations.map(o => o.status), ['importee', 'importee']);
    const again = await tx(c => compta.importLot(c, lot, A));
    assert.deepEqual(again.operations.map(o => o.status), ['deja_importee', 'deja_importee']);

    const bad = structuredClone(lot);
    bad.operations[1].ref = 'autre-ref';
    bad.operations[1].attachments[0].data = FAKE.toString('base64');
    await assert.rejects(tx(c => compta.importLot(c, bad, A)), { status: 415 });
  });

  test('avance d\'un membre puis remboursement', async () => {
    const avance = compta.OperationInput.parse({
      kind: 'depense', date: '2026-10-09', label: 'Courses Lidl', treasury: 'membre', third_party: 'Damien',
      lines: [{ category: 'ingredients', amount: 498 }],
    });
    await tx(c => compta.createEntry(c, avance, A));
    let s = await compta.getSummary();
    assert.equal(s.membres_a_rembourser, 498);
    assert.deepEqual(s.remboursements, [{ membre: 'Damien', montant: 498 }]);

    assert.throws(() => compta.OperationInput.parse({
      kind: 'virement', date: '2026-10-20', label: 'Remboursement', from: 'banque', to: 'membre', amount: 498,
    }));
    const rembourse = compta.OperationInput.parse({
      kind: 'virement', date: '2026-10-20', label: 'Remboursement Damien', from: 'banque', to: 'membre',
      third_party: 'Damien', amount: 498,
    });
    const { number } = await tx(c => compta.createEntry(c, rembourse, A));
    assert.match(number, /^BQ-/);
    s = await compta.getSummary();
    assert.equal(s.membres_a_rembourser, 0);
    assert.deepEqual(s.remboursements, []);
  });

  test('résumé : soldes et résultat de l\'exercice', async () => {
    const s = await compta.getSummary();
    assert.equal(s.tresorerie.banque, await balance('512'));
    assert.equal(s.exercice.fiscal_year.code, '2026');
    assert.equal(s.exercice.resultat, s.exercice.produits - s.exercice.charges);
  });
});
