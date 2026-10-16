import { useEffect, useMemo, useState } from 'react';
import { api, uploadAttachment } from '../../../lib/api';
import { navigate } from '../../../lib/router';
import { btn, input, Empty, Notice, PageTitle, TableSkeleton, Modal } from '../ui';
import { parseEuros, formatEuros, frDate, todayIso } from './money';
import { useComptaMeta, categoryLabel, FilePicker, prepareFile, SummaryCard } from './shared';

const DEPOT = '__depot_banque';

/**
 * Caisse (espèces) : un montant positif est une entrée, négatif une sortie.
 * Le sens est affiché en toutes lettres avant d'enregistrer.
 */
export default function Caisse() {
  const { meta } = useComptaMeta();
  const [summary, setSummary] = useState(null);
  const [moves, setMoves] = useState(null);
  const [form, setForm] = useState({ date: todayIso(), amount: '', category: '', label: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.compta.summary().then(setSummary).catch(err => setError(err.message));
    api.compta.list({ treasury: 'caisse', limit: 100 }).then(d => setMoves(d.operations)).catch(err => setError(err.message));
  };
  useEffect(load, []);

  const cents = parseEuros(form.amount);
  const direction = cents > 0 ? 'recette' : cents < 0 ? 'depense' : null;
  const categories = useMemo(() => meta?.categories.filter(c => c.direction === direction) ?? [], [meta, direction]);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const buildOp = () => {
    if (!cents) return { error: 'Saisissez un montant : 20 pour une entrée, -12,50 pour une sortie.' };
    if (!form.category) return { error: 'Choisissez une catégorie.' };
    const label = form.label.trim() || (form.category === DEPOT ? 'Dépôt des espèces en banque' : '');
    if (label.length < 2) return { error: 'Indiquez un libellé.' };
    if (form.category === DEPOT) {
      return { op: { kind: 'virement', date: form.date, label, from: 'caisse', to: 'banque', amount: -cents } };
    }
    return { op: {
      kind: direction, date: form.date, label, treasury: 'caisse',
      lines: [{ category: form.category, amount: Math.abs(cents) }],
    } };
  };

  const submit = async (e) => {
    e.preventDefault();
    const { op, error: invalid } = buildOp();
    if (invalid) { setError(invalid); return; }
    setError(null);
    try {
      const { warnings } = await api.compta.check(op);
      setConfirm({ op, warnings });
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const created = await api.compta.create(confirm.op);
      for (const file of files) {
        const { blob, name } = await prepareFile(file);
        await uploadAttachment(created.id, blob, name);
      }
      setConfirm(null);
      setFiles([]);
      setForm({ date: todayIso(), amount: '', category: '', label: '' });
      setMessage(`${cents > 0 ? 'Entrée' : 'Sortie'} de ${formatEuros(Math.abs(cents))} enregistrée (${created.number}).`);
      load();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const label = (txt, htmlFor) => <label htmlFor={htmlFor} className="block text-sm font-semibold text-warm-700 mb-1.5">{txt}</label>;

  return (
    <div className="space-y-6">
      <PageTitle title="Caisse" subtitle="Espèces. Montant positif pour une entrée, négatif pour une sortie." />

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <SummaryCard label="Solde de caisse" value={summary ? formatEuros(summary.tresorerie.caisse) : '—'} />
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-warm-100 p-5 space-y-4 max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            {label('Date', 'c-date')}
            <input id="c-date" type="date" required value={form.date} onChange={e => set({ date: e.target.value })} className={input} />
          </div>
          <div>
            {label('Montant', 'c-amount')}
            <input id="c-amount" inputMode="decimal" required placeholder="20 ou -12,50" value={form.amount}
              onChange={e => set({ amount: e.target.value, category: '' })} className={`${input} text-right tabular-nums`} />
            <p className={`mt-1.5 text-sm font-semibold ${cents > 0 ? 'text-green-800' : cents < 0 ? 'text-red-700' : 'text-warm-400'}`} aria-live="polite">
              {cents > 0 ? `Entrée de ${formatEuros(cents)}` : cents < 0 ? `Sortie de ${formatEuros(-cents)}` : form.amount ? 'Montant invalide' : ' '}
            </p>
          </div>
          <div>
            {label('Catégorie', 'c-cat')}
            <select id="c-cat" value={form.category} onChange={e => set({ category: e.target.value })} disabled={!direction} className={input}>
              <option value="">{direction ? 'Catégorie…' : 'Saisissez d\'abord le montant'}</option>
              {direction === 'depense' && <option value={DEPOT}>Dépôt des espèces en banque</option>}
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          {label('Libellé', 'c-label')}
          <input id="c-label" maxLength={255} value={form.label} onChange={e => set({ label: e.target.value })}
            placeholder={cents < 0 ? 'Achat de pain' : 'Vente de crêpes'} className={input} />
        </div>
        <div>
          <p className="text-sm font-semibold text-warm-700 mb-1.5">Justificatif (facultatif)</p>
          <FilePicker files={files} onChange={setFiles} disabled={busy} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
        <button type="submit" className={btn.primary}>Vérifier et enregistrer</button>
      </form>

      <section>
        <h2 className="font-nunito font-semibold text-warm-900 mb-3">Mouvements de caisse</h2>
        {!moves || !meta ? <TableSkeleton cols={4} /> : moves.length === 0 ? (
          <Empty message="Aucun mouvement de caisse pour l'instant." />
        ) : (
          <ul className="bg-white rounded-2xl border border-warm-100 divide-y divide-warm-50">
            {moves.map(m => {
              const signed = m.kind === 'recette' || (m.kind === 'virement' && m.to === 'caisse') ? m.total : -m.total;
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => navigate(`/admin/compta/operations/${m.id}`)}
                    className="w-full text-left px-5 py-3 flex items-center gap-4 font-nunito text-sm hover:bg-orange-50/60">
                    <span className="text-warm-500 w-24 flex-shrink-0">{frDate(m.date)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-warm-900 font-semibold truncate">{m.label}</span>
                      <span className="block text-xs text-warm-500">
                        {m.number} · {m.kind === 'virement' ? 'Virement interne' : m.categories.map(c => categoryLabel(meta, c)).join(', ')}
                      </span>
                    </span>
                    <span className={`tabular-nums font-semibold ${signed > 0 ? 'text-green-800' : 'text-warm-900'}`}>
                      {formatEuros(signed, { sign: true })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirm && (
        <Modal title={cents > 0 ? 'Confirmer l\'entrée en caisse' : 'Confirmer la sortie de caisse'} onClose={() => setConfirm(null)}>
          <div className="space-y-4 font-nunito text-sm">
            <p className={`text-lg font-bold ${cents > 0 ? 'text-green-800' : 'text-red-700'}`}>
              {cents > 0 ? 'Entrée' : 'Sortie'} de {formatEuros(Math.abs(cents))}
            </p>
            <p className="text-warm-700">
              {frDate(confirm.op.date)} · {confirm.op.label} ·{' '}
              {form.category === DEPOT ? 'Dépôt en banque' : categoryLabel(meta, form.category)}
            </p>
            {confirm.warnings.map(w => <Notice key={w.code + w.message} tone="error">{w.message}</Notice>)}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirm(null)} className={btn.secondary}>Modifier</button>
              <button type="button" disabled={busy} onClick={save} className={btn.primary}>{busy ? 'Enregistrement…' : 'Confirmer'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
