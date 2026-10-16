/**
 * Synchronisations SumUp et HelloAsso avec des API simulées, contre MariaDB :
 * écritures produites, reprise après les curseurs, aucun doublon, remboursements,
 * versements HelloAsso, rapprochement des adhérents.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dbEnabled, resetDatabase, seedUsers } from './helpers/db.js';

describe('intégrations (base réelle)', { skip: !dbEnabled && 'TEST_DB_HOST non défini' }, () => {
  let pool, sumup, helloasso, runner, compta;
  const NOW = new Date('2026-10-20T10:00:00Z');   // 12h à Paris

  const balance = async (account) => Number((await pool.execute(
    `SELECT COALESCE(SUM(CAST(debit AS SIGNED) - CAST(credit AS SIGNED)), 0) AS s FROM entry_line WHERE account_code = ?`,
    [account]))[0][0].s);
  const run = (provider, fn) => runner.runExclusive(provider, fn, { trigger: 'test' });

  before(async () => {
    pool = (await import('../config/database.js')).getPool();
    await resetDatabase(pool);
    await seedUsers(pool);
    sumup = await import('../services/integrations/sumup.js');
    helloasso = await import('../services/integrations/helloasso.js');
    runner = await import('../services/integrations/runner.js');
    compta = await import('../services/compta.js');
  });
  after(async () => { await pool?.end(); });

  test('SumUp : ventes par jour terminé, adhésions séparées, commissions, sans doublon', async () => {
    const txs = [
      { id: 't0', transaction_code: 'OLD', timestamp: '2026-10-16T09:00:00Z', amount: 3, status: 'SUCCESSFUL', product_summary: 'Gaufre' },
      { id: 't1', transaction_code: 'A1', timestamp: '2026-10-17T08:00:00Z', amount: 1.5, status: 'SUCCESSFUL', product_summary: 'Crêpe' },
      { id: 't2', transaction_code: 'A2', timestamp: '2026-10-17T21:30:00Z', amount: 7, status: 'SUCCESSFUL', product_summary: 'Adhésion' },
      { id: 't3', transaction_code: 'A3', timestamp: '2026-10-17T09:00:00Z', amount: 9, status: 'FAILED', product_summary: 'Crêpe' },
      // 22h30 UTC le 17 = 00h30 le 18 à Paris : compte pour le 18.
      { id: 't4', transaction_code: 'B1', timestamp: '2026-10-17T22:30:00Z', amount: 2, status: 'SUCCESSFUL', product_summary: null },
      { id: 't5', transaction_code: 'C1', timestamp: '2026-10-20T08:00:00Z', amount: 1, status: 'SUCCESSFUL', product_summary: 'Crêpe' },
    ];
    const payouts = [
      { id: 101, date: '2026-10-18', amount: 1.47, fee: 0.03, status: 'SUCCESSFUL', type: 'PAYOUT' },
      { id: 102, date: '2026-10-18', amount: 6.88, fee: 0.12, status: 'SUCCESSFUL', type: 'PAYOUT' },
      { id: 103, date: '2026-10-19', amount: 1.96, fee: 0.04, status: 'SUCCESSFUL', type: 'PAYOUT' },
    ];
    const api = { transactions: async () => txs, payouts: async (from, to) => payouts.filter(p => p.date >= from && p.date <= to) };

    const r1 = await run('sumup', (ctx) => sumup.syncSumup(ctx, { api, now: NOW }));
    assert.equal(r1.error, undefined, r1.error);
    assert.equal(r1.created.length, 4);
    const ops = await compta.listOperations({ treasury: 'sumup' });
    const byLabel = Object.fromEntries(ops.map(o => [o.label, o]));
    assert.equal(byLabel['Ventes SumUp du 17/10'].total, 850);
    assert.deepEqual(byLabel['Ventes SumUp du 17/10'].categories.sort(), ['cotisation', 'vente_repas']);
    assert.equal(byLabel['Ventes SumUp du 18/10'].total, 200);
    assert.equal(byLabel['Commissions SumUp du 18/10'].total, 15);
    assert.equal(byLabel['Commissions SumUp du 19/10'].total, 4);
    assert.equal(await balance('5112'), 850 + 200 - 15 - 4);

    const state = await runner.loadState('sumup');
    assert.deepEqual(state.cursor, { sales_after_day: '2026-10-19', payouts_after_day: '2026-10-19' });

    const r2 = await run('sumup', (ctx) => sumup.syncSumup(ctx, { api, now: NOW }));
    assert.deepEqual(r2.created, [], 'deuxième passage : rien de nouveau');

    // Remboursement d'une vente déjà comptée.
    txs.find(t => t.id === 't4').status = 'REFUNDED';
    txs.find(t => t.id === 't4').refunded_amount = 2;
    const r3 = await run('sumup', (ctx) => sumup.syncSumup(ctx, { api, now: NOW }));
    assert.equal(r3.created.length, 1);
    assert.equal(await balance('5112'), 850 + 200 - 15 - 4 - 200);
    assert.deepEqual((await run('sumup', (ctx) => sumup.syncSumup(ctx, { api, now: NOW }))).created, []);
  });

  test('HelloAsso : paiements, adhérents rapprochés, versements vers la banque, remboursements', async () => {
    await pool.execute(
      `INSERT INTO member (id, last_name, first_name, email, joined_on, season, amount, channel, created_at, updated_at)
       VALUES (UUID(), 'Popa', 'Serban', 'serban@ex.fr', '2026-09-25', '2026-2027', 700, 'helloasso', NOW(3), NOW(3))`
    );
    const pay = (id, date, amount, extra = {}) => ({
      id, date, amount, state: 'Authorized', cashOutState: 'Transfered',
      payer: { firstName: 'Prénom', lastName: `Nom${id}`, email: `p${id}@ex.fr` },
      order: { formType: 'Membership', formSlug: 'adhesion-2026' },
      items: [{ type: 'Membership', shareAmount: amount, name: 'Etudiant Quest' }], ...extra,
    });
    const payments = [
      // Déjà saisi à la main (avant le curseur) : seul son versement compte.
      pay(1, '2026-10-16T11:06:00Z', 700, { cashOutState: 'CashedOut', cashOutDate: '2026-10-19T07:00:00Z' }),
      pay(2, '2026-10-18T09:00:00Z', 700),
      pay(3, '2026-10-18T10:00:00Z', 1500, { order: { formType: 'Donation' }, items: [{ type: 'Donation', shareAmount: 1500 }] }),
      pay(4, '2026-10-18T11:00:00Z', 700, { payer: { firstName: 'Serban', lastName: 'Popa', email: 'SERBAN@ex.fr' } }),
      pay(5, '2026-10-18T12:00:00Z', 700, { state: 'Registered' }),
      // Versé aujourd'hui : attendra demain (journée pas terminée).
      pay(6, '2026-10-01T09:00:00Z', 700, { cashOutState: 'CashedOut', cashOutDate: '2026-10-20T07:00:00Z' }),
    ];
    const api = { payments: async () => payments };

    const r1 = await run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api, now: NOW }));
    assert.equal(r1.error, undefined, r1.error);
    assert.equal(r1.created.length, 4, 'adhésion n°2, don n°3, adhésion n°4, versement du 19/10');
    assert.equal(await balance('5113'), 700 + 1500 + 700 - 700);
    assert.equal(await balance('512'), 700);

    const ops = await compta.listOperations({ treasury: 'helloasso' });
    assert.ok(ops.some(o => o.label === 'Don Prénom Nom3 (HelloAsso)' && o.categories[0] === 'don'));
    assert.ok(ops.some(o => o.label === 'Versement HelloAsso du 19/10 vers le Crédit Mutuel' && o.total === 700));

    const [members] = await pool.execute('SELECT last_name, helloasso_ref FROM member ORDER BY last_name');
    assert.deepEqual(members.map(m => [m.last_name, m.helloasso_ref]), [['Nom2', '2'], ['Popa', '4']],
      'Nom2 créé, Popa rattaché à sa fiche existante (pas de doublon)');

    assert.deepEqual((await run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api, now: NOW }))).created, []);

    payments.find(p => p.id === 2).state = 'Refunded';
    const r3 = await run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api, now: NOW }));
    assert.equal(r3.created.length, 1);
    assert.equal(await balance('5113'), 700 + 1500 + 700 - 700 - 700);
  });

  test('erreur d\'API : enregistrée sans secret, verrou libéré', async () => {
    const api = { payments: async () => { const { IntegrationError } = await import('../services/integrations/http.js'); throw new IntegrationError('api.helloasso.com a répondu 403'); } };
    const r = await run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api, now: NOW }));
    assert.equal(r.error, 'api.helloasso.com a répondu 403');
    const s = await runner.loadState('helloasso');
    assert.equal(s.last_error, 'api.helloasso.com a répondu 403');
    assert.equal(s.lease_until, null);
  });

  test('deux synchronisations simultanées : la seconde est ignorée', async () => {
    let release;
    const slow = { payments: () => new Promise(r => { release = () => r([]); }) };
    const first = run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api: slow, now: NOW }));
    await new Promise(r => setTimeout(r, 50));
    const second = await run('helloasso', (ctx) => helloasso.syncHelloasso(ctx, { api: slow, now: NOW }));
    assert.equal(second.skipped, true);
    release();
    assert.equal((await first).error, undefined);
  });
});
