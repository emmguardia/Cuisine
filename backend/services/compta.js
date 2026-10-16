/**
 * Comptabilité : saisie des opérations et génération des écritures.
 *
 * Le bureau saisit des « opérations » simples (recette, dépense, virement
 * interne) ; ce module les traduit en pièces équilibrées (débit = crédit) sur
 * le plan comptable. Montants en centimes, entiers, jamais de flottants.
 *
 * Une pièce n'est jamais supprimée ni réécrite après 15 minutes : une
 * correction approuvée passe une écriture inverse (contre-passation) puis la
 * nouvelle version, reliées par origin_id.
 */
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { getPool } from '../config/database.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { MemberInput, createMember } from './members.js';
import { EventInput, createEvent, linkEntry } from './events.js';

/* ── Comptes de trésorerie ─────────────────────────────────────────── */
export const TREASURY_ACCOUNTS = {
  banque:    '512',
  caisse:    '530',
  sumup:     '5112',
  helloasso: '5113',
  membre:    '467',
};
export const TREASURY_LABELS = {
  banque:    'Banque (carte ou virement)',
  caisse:    'Caisse (espèces)',
  sumup:     'SumUp',
  helloasso: 'HelloAsso',
  membre:    'Avancé par un membre',
};
const ACCOUNT_TO_TREASURY = Object.fromEntries(Object.entries(TREASURY_ACCOUNTS).map(([k, v]) => [v, k]));
const JOURNAL_OF = { banque: 'BQ', caisse: 'CA', sumup: 'SU', helloasso: 'HA', membre: 'OD' };

export const SELF_EDIT_MINUTES = 15;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/* ── Schémas d'entrée ──────────────────────────────────────────────── */
const Cents     = z.number().int('Montant en centimes entiers').min(1, 'Montant nul').max(100_000_000, 'Montant trop élevé');
const DateStr   = z.iso.date('Date invalide');
const Text      = (max) => z.string().trim().max(max);
const Optional  = (max) => Text(max).nullish().transform(v => v || null);
const Line      = z.object({
  category: z.string().min(1).max(50),
  amount:   Cents,
  label:    Optional(255),
}).strict();

const common = {
  date:        DateStr,
  label:       Text(255).min(2, 'Libellé trop court'),
  third_party: Optional(255),
  notes:       Optional(2000),
};
const TreasuryIn  = z.enum(['banque', 'caisse', 'sumup', 'helloasso']);
// SumUp / HelloAsso : commissions prélevées directement sur ces comptes.
const TreasuryOut = z.enum(['banque', 'caisse', 'membre', 'sumup', 'helloasso']);
const TreasuryAny = z.enum(['banque', 'caisse', 'sumup', 'helloasso']);
// Un virement « vers membre » rembourse une avance (solde le compte 467).
const TransferTo  = z.enum(['banque', 'caisse', 'sumup', 'helloasso', 'membre']);

export const OperationInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recette'), ...common, treasury: TreasuryIn,  lines: z.array(Line).min(1).max(20) }).strict(),
  z.object({ kind: z.literal('depense'), ...common, treasury: TreasuryOut, lines: z.array(Line).min(1).max(20) }).strict(),
  z.object({ kind: z.literal('virement'), ...common, from: TreasuryAny, to: TransferTo, amount: Cents }).strict(),
]).superRefine((op, ctx) => {
  if (op.kind === 'virement' && op.from === op.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Source et destination identiques' });
  }
  if (op.kind === 'depense' && op.treasury === 'membre' && !op.third_party) {
    ctx.addIssue({ code: 'custom', path: ['third_party'], message: 'Indiquez le membre à rembourser' });
  }
  if (op.kind === 'virement' && op.to === 'membre' && !op.third_party) {
    ctx.addIssue({ code: 'custom', path: ['third_party'], message: 'Indiquez le membre remboursé' });
  }
});

export function totalOf(op) {
  return op.kind === 'virement' ? op.amount : op.lines.reduce((s, l) => s + l.amount, 0);
}

export function formatEuros(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs  = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')} €`;
}

/* ── Référentiels ──────────────────────────────────────────────────── */
async function loadCategories(conn) {
  const [rows] = await conn.execute('SELECT id, direction, label, account_code, active FROM category');
  return new Map(rows.map(r => [r.id, r]));
}

async function fiscalYearFor(conn, date) {
  const [rows] = await conn.execute(
    'SELECT id, code, status FROM fiscal_year WHERE ? BETWEEN start_date AND end_date', [date]
  );
  if (!rows.length) throw new HttpError(400, 'Aucun exercice ne couvre cette date');
  if (rows[0].status !== 'open') throw new HttpError(409, 'Cet exercice est clôturé');
  return rows[0];
}

function journalFor(op) {
  if (op.kind !== 'virement') return JOURNAL_OF[op.treasury];
  if (op.from === 'banque' || op.to === 'banque') return 'BQ';
  if (op.from === 'caisse' || op.to === 'caisse') return 'CA';
  return 'OD';
}

/** Lignes d'écriture équilibrées pour une opération. */
export function buildLines(op, categories) {
  if (op.kind === 'virement') {
    return [
      { account_code: TREASURY_ACCOUNTS[op.to],   category_id: null, label: null, debit: op.amount, credit: 0 },
      { account_code: TREASURY_ACCOUNTS[op.from], category_id: null, label: null, debit: 0, credit: op.amount },
    ];
  }

  const lines = op.lines.map((l, i) => {
    const cat = categories.get(l.category);
    if (!cat || !cat.active) {
      throw new HttpError(400, 'Catégorie inconnue', [{ champ: `lines.${i}.category`, message: 'Catégorie inconnue' }]);
    }
    if (cat.direction !== op.kind) {
      throw new HttpError(400, 'Catégorie incompatible', [{
        champ: `lines.${i}.category`,
        message: op.kind === 'recette' ? 'Catégorie de dépense sur une recette' : 'Catégorie de recette sur une dépense',
      }]);
    }
    return op.kind === 'recette'
      ? { account_code: cat.account_code, category_id: cat.id, label: l.label, debit: 0, credit: l.amount }
      : { account_code: cat.account_code, category_id: cat.id, label: l.label, debit: l.amount, credit: 0 };
  });

  const total = totalOf(op);
  const treasury = TREASURY_ACCOUNTS[op.treasury];
  lines.unshift(op.kind === 'recette'
    ? { account_code: treasury, category_id: null, label: null, debit: total, credit: 0 }
    : { account_code: treasury, category_id: null, label: null, debit: 0, credit: total });
  return lines;
}

function assertBalanced(lines) {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  if (d !== c || d === 0) throw new Error(`Écriture déséquilibrée (${d} ≠ ${c})`);
}

async function nextNumber(conn, fy, journal) {
  const [[row]] = await conn.execute(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM entry WHERE fiscal_year_id = ? AND journal = ? FOR UPDATE',
    [fy.id, journal]
  );
  const seq = Number(row.seq);
  return { seq, number: `${journal}-${fy.code}-${String(seq).padStart(4, '0')}` };
}

async function insertLines(conn, entryId, lines) {
  for (const l of lines) {
    await conn.execute(
      `INSERT INTO entry_line (entry_id, account_code, category_id, label, debit, credit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entryId, l.account_code, l.category_id, l.label, l.debit, l.credit]
    );
  }
}

async function assertCashNotNegative(conn) {
  const [[row]] = await conn.execute(
    `SELECT COALESCE(SUM(CAST(debit AS SIGNED) - CAST(credit AS SIGNED)), 0) AS solde
       FROM entry_line WHERE account_code = '530'`
  );
  if (Number(row.solde) < 0) {
    throw new HttpError(400, `Le solde de caisse deviendrait négatif (${formatEuros(Number(row.solde))})`);
  }
}

/**
 * Crée une pièce à partir d'une opération validée par OperationInput.
 * @returns {Promise<{ id: string, number: string }>}
 */
export async function createEntry(conn, op, actor, {
  source = 'manuel', importRef = null, originId = null, req = null,
} = {}) {
  const fy = await fiscalYearFor(conn, op.date);
  const lines = buildLines(op, await loadCategories(conn));
  assertBalanced(lines);

  const journal = journalFor(op);
  const { seq, number } = await nextNumber(conn, fy, journal);
  const id = randomUUID();
  const treasury = op.kind === 'virement' ? null : op.treasury;

  await conn.execute(
    `INSERT INTO entry (id, origin_id, fiscal_year_id, journal, seq, number, date, label, kind, treasury,
                        third_party, notes, source, import_ref, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [id, originId ?? id, fy.id, journal, seq, number, op.date, op.label, op.kind, treasury,
      op.third_party, op.notes, source, importRef, actor.id, actor.name ?? null]
  );
  await insertLines(conn, id, lines);
  await assertCashNotNegative(conn);

  await audit(conn, req, 'entry.create', {
    targetType: 'entry', targetId: id, actor,
    details: { number, label: op.label, kind: op.kind, amount: totalOf(op), source },
  });
  return { id, number };
}

/** Écriture inverse d'une pièce (même date, lignes débit/crédit permutées). */
async function reverseEntry(conn, entry, actor, label) {
  const fy = await fiscalYearFor(conn, entry.date);
  const { seq, number } = await nextNumber(conn, fy, entry.journal);
  const id = randomUUID();
  await conn.execute(
    `INSERT INTO entry (id, origin_id, fiscal_year_id, journal, seq, number, date, label, kind, treasury,
                        third_party, source, reverses_id, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'contrepassation', ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [id, entry.origin_id, fy.id, entry.journal, seq, number, entry.date, label, entry.treasury,
      entry.third_party, entry.source, entry.id, actor.id, actor.name ?? null]
  );
  const [lines] = await conn.execute(
    'SELECT account_code, category_id, label, debit, credit FROM entry_line WHERE entry_id = ?', [entry.id]
  );
  await insertLines(conn, id, lines.map(l => ({ ...l, debit: Number(l.credit), credit: Number(l.debit) })));
  return { id, number };
}

/* ── Lecture ───────────────────────────────────────────────────────── */
const dateOnly = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/** Reconstitue l'opération (forme de saisie) à partir des lignes d'une pièce. */
export function toOperation(entry, lines) {
  const base = {
    kind: entry.kind, date: dateOnly(entry.date), label: entry.label,
    third_party: entry.third_party ?? null, notes: entry.notes ?? null,
  };
  if (entry.kind === 'virement') {
    const to   = lines.find(l => Number(l.debit) > 0);
    const from = lines.find(l => Number(l.credit) > 0);
    return { ...base, from: ACCOUNT_TO_TREASURY[from.account_code], to: ACCOUNT_TO_TREASURY[to.account_code], amount: Number(to.debit) };
  }
  return {
    ...base,
    treasury: entry.treasury,
    lines: lines.filter(l => l.category_id).map(l => ({
      category: l.category_id,
      amount:   Number(entry.kind === 'recette' ? l.credit : l.debit),
      label:    l.label ?? null,
    })),
  };
}

async function loadEntryRow(conn, id, { lock = false } = {}) {
  const [rows] = await conn.execute(`SELECT * FROM entry WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

async function loadLines(conn, entryId) {
  const [rows] = await conn.execute(
    'SELECT account_code, category_id, label, debit, credit FROM entry_line WHERE entry_id = ? ORDER BY id', [entryId]
  );
  return rows;
}

/** État d'une pièce tel que figé dans une demande (sert à l'empreinte). */
export async function entrySnapshot(conn, id) {
  const entry = await loadEntryRow(conn, id);
  if (!entry) return null;
  const lines = await loadLines(conn, id);
  return {
    id: entry.id, origin_id: entry.origin_id, number: entry.number, status: entry.status,
    version: entry.version, journal: entry.journal, kind: entry.kind, source: entry.source,
    operation: entry.kind === 'contrepassation' ? null : toOperation(entry, lines),
  };
}

export async function getOperation(id) {
  const pool = getPool();
  const entry = await loadEntryRow(pool, id);
  if (!entry) throw new HttpError(404, 'Opération introuvable');
  const lines = await loadLines(pool, id);

  const [accounts] = await pool.execute('SELECT code, label FROM ledger_account');
  const accountLabel = Object.fromEntries(accounts.map(a => [a.code, a.label]));

  const [history] = await pool.execute(
    `SELECT id, number, kind, status, label, date, created_by_name, created_at, reverses_id
       FROM entry WHERE origin_id = ? ORDER BY created_at, seq`, [entry.origin_id]
  );
  const [attachments] = await pool.execute(
    `SELECT id, filename, mime, size, uploaded_by_name, uploaded_at
       FROM attachment WHERE origin_id = ? AND removed_at IS NULL ORDER BY uploaded_at`, [entry.origin_id]
  );
  const [pending] = await pool.execute(
    `SELECT id, type, requested_by_name FROM change_request WHERE pending_key = ?`, [`entry:${id}`]
  );

  return {
    id: entry.id,
    origin_id: entry.origin_id,
    number: entry.number,
    journal: entry.journal,
    status: entry.status,
    source: entry.source,
    created_by: entry.created_by,
    created_by_name: entry.created_by_name,
    created_at: entry.created_at,
    replaced_by_id: entry.replaced_by_id,
    self_editable_until: entry.status === 'active' && entry.kind !== 'contrepassation'
      ? new Date(new Date(entry.created_at).getTime() + SELF_EDIT_MINUTES * 60_000)
      : null,
    operation: entry.kind === 'contrepassation' ? null : toOperation(entry, lines),
    kind: entry.kind,
    label: entry.label,
    date: dateOnly(entry.date),
    total: lines.reduce((s, l) => s + Number(l.debit), 0),
    lines: lines.map(l => ({
      account_code: l.account_code, account_label: accountLabel[l.account_code],
      category_id: l.category_id, label: l.label, debit: Number(l.debit), credit: Number(l.credit),
    })),
    history: history.map(h => ({ ...h, date: dateOnly(h.date) })),
    attachments,
    pending_request: pending[0] ?? null,
  };
}

export async function listOperations({ from, to, q, treasury, category, status = 'active', limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status === 'active') where.push(`e.status = 'active' AND e.kind <> 'contrepassation'`);
  if (from)     { where.push('e.date >= ?'); params.push(from); }
  if (to)       { where.push('e.date <= ?'); params.push(to); }
  if (q)        { where.push('(e.label LIKE ? OR e.third_party LIKE ? OR e.number LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (treasury) {
    where.push(`EXISTS (SELECT 1 FROM entry_line t WHERE t.entry_id = e.id AND t.account_code = ?)`);
    params.push(TREASURY_ACCOUNTS[treasury]);
  }
  if (category === 'remboursement_membre') {
    where.push(`e.kind = 'virement' AND EXISTS (SELECT 1 FROM entry_line c WHERE c.entry_id = e.id AND c.account_code = '467' AND c.debit > 0)`);
  } else if (category) {
    where.push(`EXISTS (SELECT 1 FROM entry_line c WHERE c.entry_id = e.id AND c.category_id = ?)`);
    params.push(category);
  }

  const [rows] = await getPool().execute(
    `SELECT e.id, e.origin_id, e.number, e.date, e.label, e.kind, e.treasury, e.third_party, e.status, e.source,
            e.created_by_name, e.created_at,
            (SELECT SUM(l.debit) FROM entry_line l WHERE l.entry_id = e.id) AS total,
            (SELECT GROUP_CONCAT(DISTINCT l.category_id ORDER BY l.id SEPARATOR ',')
               FROM entry_line l WHERE l.entry_id = e.id AND l.category_id IS NOT NULL) AS categories,
            (SELECT GROUP_CONCAT(l.account_code ORDER BY l.debit DESC SEPARATOR ',')
               FROM entry_line l WHERE l.entry_id = e.id AND l.category_id IS NULL) AS treasury_accounts,
            (SELECT COUNT(*) FROM attachment a WHERE a.origin_id = e.origin_id AND a.removed_at IS NULL) AS attachments,
            (SELECT COUNT(*) FROM change_request r WHERE r.pending_key = CONCAT('entry:', e.id)) AS pending
       FROM entry e
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  return rows.map(r => {
    const accounts = (r.treasury_accounts || '').split(',').filter(Boolean);
    return {
      id: r.id, origin_id: r.origin_id, number: r.number, date: dateOnly(r.date), label: r.label,
      kind: r.kind, treasury: r.treasury, third_party: r.third_party, status: r.status, source: r.source,
      created_by_name: r.created_by_name, created_at: r.created_at,
      total: Number(r.total || 0),
      categories: (r.categories || '').split(',').filter(Boolean),
      from: r.kind === 'virement' ? ACCOUNT_TO_TREASURY[accounts[1]] : undefined,
      to:   r.kind === 'virement' ? ACCOUNT_TO_TREASURY[accounts[0]] : undefined,
      attachments: Number(r.attachments),
      pending: Number(r.pending) > 0,
    };
  });
}

export async function getSummary() {
  const pool = getPool();
  const [balances] = await pool.execute(
    `SELECT account_code, SUM(CAST(debit AS SIGNED) - CAST(credit AS SIGNED)) AS solde
       FROM entry_line WHERE account_code IN ('512', '530', '5112', '5113', '467')
      GROUP BY account_code`
  );
  const bal = Object.fromEntries(balances.map(b => [b.account_code, Number(b.solde)]));

  const [[fy]] = await pool.execute(
    `SELECT id, code, label, start_date, end_date, status FROM fiscal_year
      WHERE status = 'open' ORDER BY start_date LIMIT 1`
  );
  let result = null;
  if (fy) {
    const [[r]] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN CAST(l.credit AS SIGNED) - CAST(l.debit AS SIGNED) END), 0) AS produits,
         COALESCE(SUM(CASE WHEN a.type = 'expense' THEN CAST(l.debit AS SIGNED) - CAST(l.credit AS SIGNED) END), 0) AS charges
       FROM entry_line l
       JOIN entry e          ON e.id = l.entry_id
       JOIN ledger_account a ON a.code = l.account_code
      WHERE e.fiscal_year_id = ?`, [fy.id]
    );
    result = {
      fiscal_year: { ...fy, start_date: dateOnly(fy.start_date), end_date: dateOnly(fy.end_date) },
      produits: Number(r.produits), charges: Number(r.charges),
      resultat: Number(r.produits) - Number(r.charges),
    };
  }

  const [debts] = await pool.execute(
    `SELECT e.third_party AS membre, SUM(CAST(l.credit AS SIGNED) - CAST(l.debit AS SIGNED)) AS du
       FROM entry_line l JOIN entry e ON e.id = l.entry_id
      WHERE l.account_code = '467'
      GROUP BY e.third_party HAVING du <> 0 ORDER BY du DESC`
  );

  const [[missing]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM entry e
      WHERE e.status = 'active' AND e.kind = 'depense'
        AND NOT EXISTS (SELECT 1 FROM attachment a WHERE a.origin_id = e.origin_id AND a.removed_at IS NULL)`
  );
  const [[last]] = await pool.execute(`SELECT MAX(date) AS d FROM entry WHERE treasury = 'banque' OR journal = 'BQ'`);

  return {
    tresorerie: {
      banque: bal['512'] ?? 0, caisse: bal['530'] ?? 0,
      sumup: bal['5112'] ?? 0, helloasso: bal['5113'] ?? 0,
    },
    membres_a_rembourser: 0 - (bal['467'] ?? 0),
    remboursements: debts.map(d => ({ membre: d.membre, montant: Number(d.du) })),
    exercice: result,
    sans_justificatif: Number(missing.n),
    derniere_operation_banque: last.d ? dateOnly(last.d) : null,
  };
}

export async function getMeta() {
  const pool = getPool();
  const [categories] = await pool.execute(
    `SELECT c.id, c.direction, c.label, c.account_code, a.label AS account_label
       FROM category c JOIN ledger_account a ON a.code = c.account_code
      WHERE c.active = 1 ORDER BY c.sort_order`
  );
  const [years] = await pool.execute(
    'SELECT id, code, label, start_date, end_date, status FROM fiscal_year ORDER BY start_date'
  );
  return {
    categories,
    treasuries: TREASURY_LABELS,
    fiscal_years: years.map(y => ({ ...y, start_date: dateOnly(y.start_date), end_date: dateOnly(y.end_date) })),
    self_edit_minutes: SELF_EDIT_MINUTES,
  };
}

/* ── Contrôles avant saisie (affichés par le front, non bloquants) ── */
export async function precheck(op) {
  const warnings = [];
  const total = totalOf(op);
  const today = new Date().toISOString().slice(0, 10);
  if (op.date > today) warnings.push({ code: 'future_date', message: 'La date est dans le futur.' });
  if (total >= 50_000) warnings.push({ code: 'large_amount', message: `Montant important : ${formatEuros(total)}.` });

  const [dups] = await getPool().execute(
    `SELECT e.number, e.label FROM entry e
      WHERE e.status = 'active' AND e.kind = ? AND e.date = ?
        AND (SELECT SUM(l.debit) FROM entry_line l WHERE l.entry_id = e.id) = ?`,
    [op.kind, op.date, total]
  );
  for (const d of dups) {
    warnings.push({ code: 'duplicate', message: `Une opération identique existe déjà ce jour-là : ${d.number} (${d.label}).` });
  }
  return warnings;
}

/* ── Correction de sa propre saisie (15 minutes) ───────────────────── */
export async function selfCorrect(conn, id, op, actor, req) {
  const entry = await loadEntryRow(conn, id, { lock: true });
  if (!entry) throw new HttpError(404, 'Opération introuvable');
  if (entry.status !== 'active' || entry.kind === 'contrepassation') {
    throw new HttpError(409, 'Cette opération n\'est plus modifiable');
  }
  const age = Date.now() - new Date(entry.created_at).getTime();
  if (entry.created_by !== actor.id || age > SELF_EDIT_MINUTES * 60_000) {
    throw new HttpError(409,
      'La correction directe n\'est possible que par l\'auteur, dans les 15 minutes : faites une demande de modification',
      undefined, 'REQUEST_REQUIRED');
  }

  const before = toOperation(entry, await loadLines(conn, id));
  const fy = await fiscalYearFor(conn, op.date);
  const lines = buildLines(op, await loadCategories(conn));
  assertBalanced(lines);

  const journal = journalFor(op);
  let { seq, number } = entry;
  if (journal !== entry.journal || fy.id !== entry.fiscal_year_id) {
    ({ seq, number } = await nextNumber(conn, fy, journal));
  }

  await conn.execute('DELETE FROM entry_line WHERE entry_id = ?', [id]);
  await conn.execute(
    `UPDATE entry SET fiscal_year_id = ?, journal = ?, seq = ?, number = ?, date = ?, label = ?, kind = ?,
                      treasury = ?, third_party = ?, notes = ?, updated_at = NOW(3), version = version + 1
      WHERE id = ?`,
    [fy.id, journal, seq, number, op.date, op.label, op.kind, op.kind === 'virement' ? null : op.treasury,
      op.third_party, op.notes, id]
  );
  await insertLines(conn, id, lines);
  await assertCashNotNegative(conn);

  await audit(conn, req, 'entry.self_correct', {
    targetType: 'entry', targetId: id, actor, details: { number, before, after: op },
  });
  return { id, number };
}

/* ── Remplacement et annulation (appliqués après double validation) ── */
export async function replaceEntry(conn, id, op, actor, req) {
  const entry = await loadEntryRow(conn, id, { lock: true });
  const reversal = await reverseEntry(conn, entry, actor, `Correction de ${entry.number} — ${entry.label}`.slice(0, 255));
  const created = await createEntry(conn, op, actor, { source: entry.source, originId: entry.origin_id, req });
  await conn.execute(
    `UPDATE entry SET status = 'replaced', replaced_by_id = ?, updated_at = NOW(3), version = version + 1 WHERE id = ?`,
    [created.id, id]
  );
  await audit(conn, req, 'entry.replace', {
    targetType: 'entry', targetId: id, actor,
    details: { number: entry.number, reversal: reversal.number, replacement: created.number },
  });
  return created;
}

export async function cancelEntry(conn, id, actor, req) {
  const entry = await loadEntryRow(conn, id, { lock: true });
  const reversal = await reverseEntry(conn, entry, actor, `Annulation de ${entry.number} — ${entry.label}`.slice(0, 255));
  await conn.execute(
    `UPDATE entry SET status = 'cancelled', updated_at = NOW(3), version = version + 1 WHERE id = ?`, [id]
  );
  await assertCashNotNegative(conn);
  await audit(conn, req, 'entry.cancel', {
    targetType: 'entry', targetId: id, actor, details: { number: entry.number, reversal: reversal.number },
  });
  return reversal;
}

/* ── Justificatifs ─────────────────────────────────────────────────── */
const SIGNATURES = [
  { mime: 'image/jpeg',      test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png',       test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp',      test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { mime: 'application/pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];

/** Type réel d'après les octets d'en-tête (null si non autorisé). */
export function sniffMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return SIGNATURES.find(s => s.test(buffer))?.mime ?? null;
}

export function cleanFilename(name, mime) {
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[mime];
  const base = String(name || 'justificatif')
    .split(/[\\/]/).pop()
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .trim()
    .slice(0, 100) || 'justificatif';
  return base + ext;
}

export async function addAttachment(conn, entryId, { filename, buffer, declaredMime }, actor, req) {
  const entry = await loadEntryRow(conn, entryId);
  if (!entry) throw new HttpError(404, 'Opération introuvable');
  if (!buffer?.length) throw new HttpError(400, 'Fichier vide');
  if (buffer.length > MAX_ATTACHMENT_BYTES) throw new HttpError(413, 'Fichier trop lourd (8 Mo maximum)');

  const mime = sniffMime(buffer);
  if (!mime) throw new HttpError(415, 'Format refusé : JPEG, PNG, WebP ou PDF uniquement');
  if (declaredMime && declaredMime !== mime) throw new HttpError(415, 'Le contenu du fichier ne correspond pas à son type');

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const [dup] = await conn.execute(
    'SELECT id FROM attachment WHERE origin_id = ? AND sha256 = ? AND removed_at IS NULL', [entry.origin_id, sha256]
  );
  if (dup.length) throw new HttpError(409, 'Ce fichier est déjà joint à cette opération');

  const id = randomUUID();
  const name = cleanFilename(filename, mime);
  await conn.execute(
    `INSERT INTO attachment (id, origin_id, filename, mime, size, sha256, data, uploaded_by, uploaded_by_name, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
    [id, entry.origin_id, name, mime, buffer.length, sha256, buffer, actor.id, actor.name ?? null]
  );
  await audit(conn, req, 'attachment.add', {
    targetType: 'entry', targetId: entryId, actor, details: { attachment_id: id, filename: name, size: buffer.length, sha256 },
  });
  return { id, filename: name, mime, size: buffer.length };
}

export async function getAttachment(id) {
  const [rows] = await getPool().execute(
    'SELECT id, filename, mime, size, data FROM attachment WHERE id = ? AND removed_at IS NULL', [id]
  );
  if (!rows.length) throw new HttpError(404, 'Justificatif introuvable');
  return rows[0];
}

/* ── Import d'un lot (reprise de l'historique, relevés + justificatifs) ── */
const LotAttachment = z.object({
  filename: z.string().min(1).max(255),
  mime:     z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  data:     z.base64().max(Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4),
}).strict();

export const LotInput = z.object({
  format:     z.literal('quisine-lot'),
  version:    z.literal(1),
  label:      z.string().trim().min(2).max(255),
  operations: z.array(z.object({
    ref:         z.string().regex(/^[a-z0-9][a-z0-9._-]{2,99}$/, 'Référence invalide'),
    operation:   OperationInput,
    attachments: z.array(LotAttachment).max(10).default([]),
  }).strict()).max(500).default([]),
  members: z.array(z.object({
    ref:    z.string().regex(/^[a-z0-9][a-z0-9._-]{2,99}$/, 'Référence invalide'),
    member: MemberInput,
  }).strict()).max(1000).default([]),
  events: z.array(z.object({
    ref:        z.string().regex(/^[a-z0-9][a-z0-9._-]{2,99}$/, 'Référence invalide'),
    event:      EventInput,
    operations: z.array(z.object({
      ref:    z.string().max(100),
      amount: z.number().int().min(1).nullish(),
    }).strict()).max(200).default([]),
  }).strict()).max(100).default([]),
}).strict();

/**
 * Importe un lot. Tout ou rien, et sans doublon : une opération dont la
 * référence a déjà été importée est ignorée (réimporter le même fichier ne
 * change rien).
 */
export async function importLot(conn, lot, actor, { dryRun = false, req = null } = {}) {
  const refs = lot.operations.map(o => `lot:${o.ref}`);
  if (new Set(refs).size !== refs.length) throw new HttpError(400, 'Références en double dans le lot');
  if (!lot.operations.length && !lot.members.length && !lot.events.length) throw new HttpError(400, 'Lot vide');

  const existingRefs = async (table, list) => {
    if (!list.length) return new Set();
    const [rows] = await conn.query(`SELECT import_ref FROM ${table} WHERE import_ref IN (?)`, [list]);
    return new Set(rows.map(r => r.import_ref));
  };
  const already = await existingRefs('entry', refs);
  const categories = await loadCategories(conn);

  const report = [];
  for (const item of lot.operations) {
    const importRef = `lot:${item.ref}`;
    buildLines(item.operation, categories); // valide les catégories avant toute écriture
    for (const a of item.attachments) {
      const buf = Buffer.from(a.data, 'base64');
      if (sniffMime(buf) !== a.mime) throw new HttpError(415, `Justificatif invalide : ${a.filename}`);
    }
    report.push({
      ref: item.ref, date: item.operation.date, label: item.operation.label, kind: item.operation.kind,
      amount: totalOf(item.operation), attachments: item.attachments.length,
      status: already.has(importRef) ? 'deja_importee' : 'a_importer',
    });
  }

  const memberRefs = await existingRefs('member', lot.members.map(m => `lot:${m.ref}`));
  const members = lot.members.map(m => ({
    ref: m.ref, name: `${m.member.first_name} ${m.member.last_name}`,
    status: memberRefs.has(`lot:${m.ref}`) ? 'deja_importee' : 'a_importer',
  }));

  const eventRefs = await existingRefs('event', lot.events.map(e => `lot:${e.ref}`));
  const lotOps = new Set(lot.operations.map(o => o.ref));
  const events = lot.events.map(e => {
    for (const o of e.operations) {
      if (!lotOps.has(o.ref)) throw new HttpError(400, `Événement « ${e.event.name} » : opération inconnue ${o.ref}`);
    }
    return { ref: e.ref, name: e.event.name, date: e.event.date, operations: e.operations.length,
      status: eventRefs.has(`lot:${e.ref}`) ? 'deja_importee' : 'a_importer' };
  });

  if (dryRun) return { dry_run: true, operations: report, members, events };

  const entryIdByRef = new Map();
  for (const item of lot.operations) {
    const importRef = `lot:${item.ref}`;
    const row = report.find(r => r.ref === item.ref);
    if (already.has(importRef)) continue;
    const { id, number } = await createEntry(conn, item.operation, actor, { source: 'import', importRef, req });
    for (const a of item.attachments) {
      await addAttachment(conn, id, { filename: a.filename, buffer: Buffer.from(a.data, 'base64'), declaredMime: a.mime }, actor, req);
    }
    entryIdByRef.set(item.ref, id);
    row.status = 'importee';
    row.number = number;
  }

  for (const [i, m] of lot.members.entries()) {
    if (members[i].status === 'deja_importee') continue;
    await createMember(conn, m.member, actor, { importRef: `lot:${m.ref}`, req });
    members[i].status = 'importee';
  }

  for (const [i, e] of lot.events.entries()) {
    if (events[i].status === 'deja_importee') continue;
    const eventId = await createEvent(conn, e.event, actor, { importRef: `lot:${e.ref}`, req });
    for (const o of e.operations) {
      let entryId = entryIdByRef.get(o.ref);
      if (!entryId) {
        const [rows] = await conn.execute(
          `SELECT e2.id FROM entry e1 JOIN entry e2 ON e2.origin_id = e1.origin_id AND e2.status = 'active'
            WHERE e1.import_ref = ?`, [`lot:${o.ref}`]);
        entryId = rows[0]?.id;
      }
      if (entryId) await linkEntry(conn, eventId, { entry_id: entryId, amount: o.amount ?? null }, actor, req);
    }
    events[i].status = 'importee';
  }

  await audit(conn, req, 'compta.import', {
    targetType: 'lot', targetId: lot.label, actor,
    details: {
      imported: report.filter(r => r.status === 'importee').length,
      skipped: report.filter(r => r.status === 'deja_importee').length,
      members: members.filter(m => m.status === 'importee').length,
      events: events.filter(e => e.status === 'importee').length,
    },
  });
  return { dry_run: false, operations: report, members, events };
}
