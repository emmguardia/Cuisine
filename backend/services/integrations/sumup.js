/**
 * Synchronisation SumUp (terminal de paiement).
 *
 *  - Ventes : une opération par jour terminé (heure de Paris), sur le compte
 *    « SumUp », ventes et adhésions sur des lignes séparées.
 *  - Commissions : une dépense par jour de versement, prélevée sur SumUp.
 *  - Remboursement d'une vente déjà comptée : dépense « Remboursement client ».
 *
 * Le virement du compte SumUp vers le Crédit Mutuel est fait à la main par le
 * bureau : il se saisit comme un virement interne SumUp → Banque.
 */
import { withTransaction } from '../../config/database.js';
import { OperationInput, createEntry } from '../compta.js';
import { fetchJson } from './http.js';
import { parisDay, frDay, addDays } from './time.js';

export const SUMUP_ACTOR = { id: null, name: 'Synchronisation SumUp' };
const API = 'https://api.sumup.com';

const cents = (v) => Math.round(Number(v || 0) * 100);
const isMembership = (t) => /adh[ée]sion/i.test(t.product_summary || '');

export function sumupApi({ apiKey, merchantCode, fetch = fetchJson }) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const base = `${API}/v2.1/merchants/${encodeURIComponent(merchantCode)}/transactions/history`;
  return {
    async transactions(oldestDay) {
      const all = [];
      let url = `${base}?order=ascending&limit=100&oldest_time=${encodeURIComponent(`${oldestDay}T00:00:00Z`)}`;
      for (let page = 0; url && page < 50; page++) {
        const data = await fetch(url, { headers });
        all.push(...(data?.items ?? []));
        const next = (data?.links ?? []).find(l => l.rel === 'next')?.href;
        url = next ? (next.startsWith('http') ? next : `${base}?${next.replace(/^\?/, '')}`) : null;
      }
      return all;
    },
    async payouts(fromDay, toDay) {
      const url = `${API}/v1.0/merchants/${encodeURIComponent(merchantCode)}/payouts`
        + `?start_date=${fromDay}&end_date=${toDay}&format=json&order=asc&limit=500`;
      return (await fetch(url, { headers })) ?? [];
    },
  };
}

async function known(conn, kind, ids) {
  if (!ids.length) return new Set();
  const [rows] = await conn.query(
    `SELECT external_id FROM external_transaction WHERE provider = 'sumup' AND kind = ? AND external_id IN (?)`, [kind, ids]
  );
  return new Set(rows.map(r => r.external_id));
}

async function record(conn, kind, items, originId) {
  for (const it of items) {
    await conn.execute(
      `INSERT INTO external_transaction (provider, external_id, kind, occurred_at, amount, fee, origin_id)
       VALUES ('sumup', ?, ?, ?, ?, ?, ?)`,
      [it.id, kind, it.at ? new Date(it.at) : null, it.amount ?? 0, it.fee ?? 0, originId]
    );
  }
}

/**
 * @param {{ cursor: { sales_after_day: string, payouts_after_day: string }, save: Function }} ctx
 * @param {{ api: ReturnType<typeof sumupApi>, now?: Date, actor?: object }} deps
 */
export async function syncSumup({ cursor, save }, { api, now = new Date(), actor = SUMUP_ACTOR }) {
  const today = parisDay(now);
  const yesterday = addDays(today, -1);
  const created = [];

  /* ── Ventes (jours terminés) et remboursements ─────────────────────── */
  // 45 jours en arrière : assez pour voir les remboursements de ventes déjà comptées.
  const txs = await api.transactions(addDays(cursor.sales_after_day, -45));
  const sales = txs
    .filter(t => t.status === 'SUCCESSFUL' && t.type !== 'REFUND')
    .map(t => ({ ...t, day: parisDay(t.timestamp), key: t.transaction_code || t.id }));

  const days = [...new Set(sales.map(s => s.day))]
    .filter(d => d > cursor.sales_after_day && d < today)
    .sort();

  for (const day of days) {
    const number = await withTransaction(async (conn) => {
      const ofDay = sales.filter(s => s.day === day);
      const done = await known(conn, 'sale', ofDay.map(s => s.key));
      const todo = ofDay.filter(s => !done.has(s.key));
      if (!todo.length) return null;

      const adh = todo.filter(isMembership);
      const ventes = todo.filter(s => !isMembership(s));
      const sum = (list) => list.reduce((n, s) => n + cents(s.amount), 0);
      const lines = [];
      if (ventes.length) lines.push({ category: 'vente_repas', amount: sum(ventes), label: `${ventes.length} paiement${ventes.length > 1 ? 's' : ''}` });
      if (adh.length) lines.push({ category: 'cotisation', amount: sum(adh), label: `${adh.length} adhésion${adh.length > 1 ? 's' : ''}` });

      const op = OperationInput.parse({
        kind: 'recette', date: day, treasury: 'sumup', third_party: 'SumUp',
        label: ventes.length ? `Ventes SumUp du ${frDay(day)}` : `Adhésions SumUp du ${frDay(day)}`,
        notes: 'Saisie automatique depuis SumUp (paiements réussis de la journée).',
        lines,
      });
      const entry = await createEntry(conn, op, actor, { source: 'sumup' });
      await record(conn, 'sale', todo.map(s => ({ id: s.key, at: s.timestamp, amount: cents(s.amount) })), entry.id);
      return entry.number;
    });
    if (number) created.push(number);
  }

  const refunded = txs.filter(t => t.status === 'REFUNDED' || cents(t.refunded_amount) > 0);
  if (refunded.length) {
    const number = await withTransaction(async (conn) => {
      const keys = refunded.map(t => t.transaction_code || t.id);
      const counted = await known(conn, 'sale', keys);
      const already = await known(conn, 'refund', keys);
      const todo = refunded.filter(t => counted.has(t.transaction_code || t.id) && !already.has(t.transaction_code || t.id));
      if (!todo.length) return null;
      const amount = todo.reduce((n, t) => n + (cents(t.refunded_amount) || cents(t.amount)), 0);
      const op = OperationInput.parse({
        kind: 'depense', date: today, treasury: 'sumup', third_party: 'SumUp',
        label: `Remboursement${todo.length > 1 ? 's' : ''} client SumUp`,
        notes: `Ventes remboursées : ${todo.map(t => `${parisDay(t.timestamp).split('-').reverse().join('/')} ${(cents(t.amount) / 100).toFixed(2)} €`).join(', ')}.`,
        lines: [{ category: 'remboursement_client', amount }],
      });
      const entry = await createEntry(conn, op, actor, { source: 'sumup' });
      await record(conn, 'refund', todo.map(t => ({ id: t.transaction_code || t.id, at: t.timestamp, amount: cents(t.refunded_amount) || cents(t.amount) })), entry.id);
      return entry.number;
    });
    if (number) created.push(number);
  }

  /* ── Commissions (jours de versement terminés) ─────────────────────── */
  let payoutsAfter = cursor.payouts_after_day;
  if (payoutsAfter < yesterday) {
    const payouts = await api.payouts(addDays(payoutsAfter, 1), yesterday);
    const byDay = new Map();
    for (const p of payouts) {
      if (p.status && p.status !== 'SUCCESSFUL') continue;
      const day = String(p.date).slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push({ id: String(p.id), at: `${day}T12:00:00Z`, amount: cents(p.amount), fee: cents(p.fee) });
    }
    for (const day of [...byDay.keys()].sort()) {
      const number = await withTransaction(async (conn) => {
        const items = byDay.get(day);
        const done = await known(conn, 'payout', items.map(i => i.id));
        const todo = items.filter(i => !done.has(i.id));
        const fees = todo.reduce((n, i) => n + i.fee, 0);
        if (!todo.length) return null;
        let number = null;
        let originId = null;
        if (fees > 0) {
          const op = OperationInput.parse({
            kind: 'depense', date: day, treasury: 'sumup', third_party: 'SumUp',
            label: `Commissions SumUp du ${frDay(day)}`,
            notes: `Retenues sur ${todo.length} versement${todo.length > 1 ? 's' : ''} SumUp.`,
            lines: [{ category: 'frais_bancaires', amount: fees }],
          });
          const entry = await createEntry(conn, op, actor, { source: 'sumup' });
          number = entry.number;
          originId = entry.id;
        }
        await record(conn, 'payout', todo, originId);
        return number;
      });
      if (number) created.push(number);
    }
    payoutsAfter = yesterday;
  }

  // Tous les jours terminés ont été traités : on reprendra après hier.
  const next = {
    sales_after_day: yesterday > cursor.sales_after_day ? yesterday : cursor.sales_after_day,
    payouts_after_day: payoutsAfter,
  };
  await save(next);
  return { created, cursor: next };
}
