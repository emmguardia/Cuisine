/**
 * Synchronisation HelloAsso (adhésions, dons, ventes en ligne).
 *
 *  - Chaque paiement accepté devient une recette sur le compte « HelloAsso »
 *    (adhésion, don ou vente selon le formulaire).
 *  - Une adhésion crée ou complète la fiche de l'adhérent (sans doublon avec
 *    une fiche saisie à la main : rapprochement par email et saison).
 *  - Chaque versement de HelloAsso vers le Crédit Mutuel devient un virement
 *    interne HelloAsso → Banque : pas besoin du relevé pour ces rentrées.
 *  - Un paiement remboursé après coup devient une dépense « Remboursement client ».
 *
 * HelloAsso ne prélève pas de commission (contribution volontaire du payeur).
 */
import { withTransaction } from '../../config/database.js';
import { OperationInput, createEntry } from '../compta.js';
import { createMember } from '../members.js';
import { fetchJson } from './http.js';
import { parisDay, frDay, addDays, seasonOf } from './time.js';

export const HELLOASSO_ACTOR = { id: null, name: 'Synchronisation HelloAsso' };
const API = 'https://api.helloasso.com';

export function helloassoApi({ clientId, clientSecret, orgSlug, fetch = fetchJson }) {
  let token = null;
  let tokenExpires = 0;

  async function auth() {
    if (token && Date.now() < tokenExpires) return token;
    const data = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
    });
    token = data.access_token;
    tokenExpires = Date.now() + Math.max(60, (data.expires_in ?? 1800) - 120) * 1000;
    return token;
  }

  return {
    async payments(fromIso) {
      const all = [];
      let continuation = null;
      for (let page = 0; page < 50; page++) {
        const q = new URLSearchParams({ from: fromIso, pageSize: '100', sortOrder: 'Asc' });
        if (continuation) q.set('continuationToken', continuation);
        const data = await fetch(`${API}/v5/organizations/${encodeURIComponent(orgSlug)}/payments?${q}`, {
          headers: { Authorization: `Bearer ${await auth()}` },
        });
        const items = data?.data ?? [];
        all.push(...items);
        continuation = data?.pagination?.continuationToken;
        if (!items.length || !continuation) break;
      }
      return all;
    },
  };
}

const KIND_LABEL = { cotisation: 'Adhésion', don: 'Don', vente_repas: 'Paiement' };

function categoryOf(type) {
  if (type === 'Membership') return 'cotisation';
  if (type === 'Donation') return 'don';
  return 'vente_repas';
}

/** Lignes de la recette : détail des articles si cohérent, sinon le formulaire. */
function linesOf(p) {
  const items = (p.items ?? []).map(i => ({
    category: categoryOf(i.type),
    amount: Number(i.shareAmount ?? i.amount ?? 0),
    label: i.name ? String(i.name).slice(0, 255) : null,
  })).filter(l => l.amount > 0);
  if (items.length && items.reduce((n, l) => n + l.amount, 0) === Number(p.amount)) return items;
  return [{ category: categoryOf(p.order?.formType), amount: Number(p.amount), label: p.order?.formSlug ?? null }];
}

const payerName = (p) => [p.payer?.firstName, p.payer?.lastName].filter(Boolean).join(' ').trim() || 'Payeur HelloAsso';

async function known(conn, kind, ids) {
  if (!ids.length) return new Set();
  const [rows] = await conn.query(
    `SELECT external_id FROM external_transaction WHERE provider = 'helloasso' AND kind = ? AND external_id IN (?)`, [kind, ids]
  );
  return new Set(rows.map(r => r.external_id));
}

async function record(conn, kind, id, at, amount, originId) {
  await conn.execute(
    `INSERT INTO external_transaction (provider, external_id, kind, occurred_at, amount, origin_id)
     VALUES ('helloasso', ?, ?, ?, ?, ?)`, [id, kind, at ? new Date(at) : null, amount, originId]
  );
}

/** Crée la fiche adhérent, ou rattache le paiement à une fiche existante. */
async function upsertMember(conn, p, actor) {
  const ref = String(p.id);
  const day = parisDay(p.date);
  const season = seasonOf(day);
  const email = p.payer?.email?.trim().toLowerCase() || null;
  const [byRef] = await conn.execute('SELECT id FROM member WHERE helloasso_ref = ?', [ref]);
  if (byRef.length) return;
  const [match] = await conn.execute(
    `SELECT id FROM member WHERE helloasso_ref IS NULL AND season = ?
       AND ((? IS NOT NULL AND LOWER(email) = ?) OR (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?)))
     LIMIT 1`, [season, email, email, p.payer?.lastName ?? '', p.payer?.firstName ?? '']
  );
  if (match.length) {
    await conn.execute('UPDATE member SET helloasso_ref = ?, updated_at = NOW(3) WHERE id = ?', [ref, match[0].id]);
    return;
  }
  const membership = (p.items ?? []).find(i => i.type === 'Membership');
  await createMember(conn, {
    last_name: (p.payer?.lastName || 'Inconnu').slice(0, 100),
    first_name: (p.payer?.firstName || '-').slice(0, 100),
    email, joined_on: day, season,
    amount: Number(membership?.shareAmount ?? membership?.amount ?? p.amount),
    tarif: membership?.name ? String(membership.name).slice(0, 100) : null,
    channel: 'helloasso', notes: 'Ajouté par la synchronisation HelloAsso',
  }, actor, { helloassoRef: ref });
}

/**
 * @param {{ cursor: { payments_after: string, cashouts_after_day: string }, save: Function }} ctx
 * @param {{ api: ReturnType<typeof helloassoApi>, now?: Date, actor?: object }} deps
 */
export async function syncHelloasso({ cursor, save }, { api, now = new Date(), actor = HELLOASSO_ACTOR }) {
  const today = parisDay(now);
  const created = [];
  const payments = await api.payments(`${addDays(cursor.cashouts_after_day, -365)}T00:00:00Z`);

  /* ── Nouveaux paiements ──────────────────────────────────────────── */
  const after = new Date(cursor.payments_after).getTime();
  let latest = after;
  for (const p of payments) {
    const at = new Date(p.date).getTime();
    if (p.state !== 'Authorized' || !(at > after)) continue;
    const number = await withTransaction(async (conn) => {
      const id = String(p.id);
      if ((await known(conn, 'payment', [id])).size) return null;
      const lines = linesOf(p);
      const main = lines[0].category;
      const op = OperationInput.parse({
        kind: 'recette', date: parisDay(p.date), treasury: 'helloasso', third_party: payerName(p),
        label: `${KIND_LABEL[main]} ${payerName(p)} (HelloAsso)`.slice(0, 255),
        notes: `Paiement HelloAsso n°${id}${p.order?.formSlug ? `, formulaire « ${p.order.formSlug} »` : ''}.`,
        lines,
      });
      const entry = await createEntry(conn, op, actor, { source: 'helloasso' });
      await record(conn, 'payment', id, p.date, Number(p.amount), entry.id);
      if (lines.some(l => l.category === 'cotisation')) await upsertMember(conn, p, actor);
      return entry.number;
    });
    if (number) created.push(number);
    latest = Math.max(latest, at);
  }

  /* ── Paiements remboursés après avoir été comptés ────────────────── */
  const refunded = payments.filter(p => p.state === 'Refunded');
  for (const p of refunded) {
    const number = await withTransaction(async (conn) => {
      const id = String(p.id);
      if (!(await known(conn, 'payment', [id])).size || (await known(conn, 'refund', [id])).size) return null;
      const op = OperationInput.parse({
        kind: 'depense', date: today, treasury: 'helloasso', third_party: payerName(p),
        label: `Remboursement ${payerName(p)} (HelloAsso)`.slice(0, 255),
        notes: `Paiement HelloAsso n°${id} du ${parisDay(p.date).split('-').reverse().join('/')} remboursé.`,
        lines: [{ category: 'remboursement_client', amount: Number(p.amount) }],
      });
      const entry = await createEntry(conn, op, actor, { source: 'helloasso' });
      await record(conn, 'refund', id, p.date, Number(p.amount), entry.id);
      return entry.number;
    });
    if (number) created.push(number);
  }

  /* ── Versements HelloAsso → Crédit Mutuel ────────────────────────── */
  const byDay = new Map();
  for (const p of payments) {
    if (p.cashOutState !== 'CashedOut' || !p.cashOutDate) continue;
    const day = parisDay(p.cashOutDate);
    if (!(day > cursor.cashouts_after_day && day < today)) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  }
  let cashoutsAfter = cursor.cashouts_after_day;
  for (const day of [...byDay.keys()].sort()) {
    const number = await withTransaction(async (conn) => {
      const list = byDay.get(day);
      const done = await known(conn, 'cashout', list.map(p => String(p.id)));
      const todo = list.filter(p => !done.has(String(p.id)));
      if (!todo.length) return null;
      const amount = todo.reduce((n, p) => n + Number(p.amount), 0);
      const op = OperationInput.parse({
        kind: 'virement', date: day, from: 'helloasso', to: 'banque',
        label: `Versement HelloAsso du ${frDay(day)} vers le Crédit Mutuel`,
        notes: `${todo.length} paiement${todo.length > 1 ? 's' : ''} : ${todo.map(payerName).join(', ')}.`.slice(0, 2000),
        amount,
      });
      const entry = await createEntry(conn, op, actor, { source: 'helloasso' });
      for (const p of todo) await record(conn, 'cashout', String(p.id), p.cashOutDate, Number(p.amount), entry.id);
      return entry.number;
    });
    if (number) created.push(number);
    cashoutsAfter = day;
  }

  const next = { payments_after: new Date(latest).toISOString(), cashouts_after_day: cashoutsAfter };
  await save(next);
  return { created, cursor: next };
}
