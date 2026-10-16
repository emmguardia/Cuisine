import { useEffect, useMemo, useState } from 'react';
import { api, uploadAttachment } from '../../../lib/api';
import { navigate } from '../../../lib/router';
import { btn, input, Notice, Modal, RequestDialog } from '../ui';
import { parseEuros, formatEuros, centsToInput, todayIso, frDate, KIND_LABELS } from './money';
import { useComptaMeta, FilePicker, prepareFile, categoryLabel, treasuryText } from './shared';

const TREASURIES = {
  recette:  ['banque', 'caisse', 'sumup', 'helloasso'],
  depense:  ['banque', 'caisse', 'membre', 'sumup', 'helloasso'],
  virement: ['banque', 'caisse', 'sumup', 'helloasso'],
};

const emptyLine = () => ({ category: '', amount: '', label: '' });

function fromOperation(op) {
  if (!op) {
    return { kind: 'depense', date: todayIso(), label: '', third_party: '', notes: '', treasury: 'banque',
      lines: [emptyLine()], from: 'caisse', to: 'banque', amount: '' };
  }
  return {
    kind: op.kind, date: op.date, label: op.label, third_party: op.third_party ?? '', notes: op.notes ?? '',
    treasury: op.treasury ?? 'banque',
    lines: op.lines?.map(l => ({ category: l.category, amount: centsToInput(l.amount), label: l.label ?? '' })) ?? [emptyLine()],
    from: op.from ?? 'caisse', to: op.to ?? 'banque', amount: op.amount != null ? centsToInput(op.amount) : '',
  };
}

/** Construit l'opération envoyée à l'API, ou renvoie un message d'erreur. */
function toPayload(f) {
  const base = {
    kind: f.kind, date: f.date, label: f.label.trim(),
    third_party: f.third_party.trim() || null, notes: f.notes.trim() || null,
  };
  if (base.label.length < 2) return { error: 'Indiquez un libellé.' };
  if (f.kind === 'virement') {
    const amount = parseEuros(f.amount);
    if (!amount || amount <= 0) return { error: 'Montant invalide.' };
    if (f.from === f.to) return { error: 'Source et destination identiques.' };
    if (f.to === 'membre' && !base.third_party) return { error: 'Indiquez le membre remboursé.' };
    return { op: { ...base, from: f.from, to: f.to, amount } };
  }
  const lines = [];
  for (const [i, l] of f.lines.entries()) {
    const amount = parseEuros(l.amount);
    if (!l.category) return { error: `Ligne ${i + 1} : choisissez une catégorie.` };
    if (!amount || amount <= 0) return { error: `Ligne ${i + 1} : montant invalide (ex. 12,50).` };
    lines.push({ category: l.category, amount, label: l.label.trim() || null });
  }
  if (f.treasury === 'membre' && !base.third_party) return { error: 'Indiquez le membre qui a payé.' };
  return { op: { ...base, treasury: f.treasury, lines } };
}

/**
 * Saisie d'une opération.
 *  mode="create"  : nouvelle opération (+ justificatifs)
 *  mode="correct" : correction directe par l'auteur (15 min)
 *  mode="request" : demande de correction (double validation)
 */
/** Choix du membre : liste des adhérents, ou saisie libre (« Autre personne »). */
function MemberPicker({ id, value, onChange }) {
  const [members, setMembers] = useState([]);
  useEffect(() => {
    api.membres.list().then(d => setMembers(d.members.map(m => `${m.first_name} ${m.last_name}`).sort((a, b) => a.localeCompare(b, 'fr'))))
      .catch(() => setMembers([]));
  }, []);
  const known = members.includes(value);
  const [other, setOther] = useState(false);
  const showInput = other || (value && !known && members.length > 0);
  return (
    <div className="space-y-2">
      <select id={id} required={!showInput} value={showInput ? '__autre' : value}
        onChange={e => { if (e.target.value === '__autre') { setOther(true); onChange(''); } else { setOther(false); onChange(e.target.value); } }}
        className={input}>
        <option value="">Choisir un adhérent…</option>
        {members.map(n => <option key={n} value={n}>{n}</option>)}
        <option value="__autre">Autre personne…</option>
      </select>
      {showInput && (
        <input aria-label="Nom de la personne" required maxLength={255} value={value} onChange={e => onChange(e.target.value)}
          placeholder="Prénom Nom" className={input} />
      )}
    </div>
  );
}

export default function OperationForm({ mode = 'create', initial = null, operationId = null, onCancel }) {
  const { meta, error: metaError } = useComptaMeta();
  const [f, setF] = useState(() => fromOperation(initial));
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);   // { op, warnings }
  const [requestOp, setRequestOp] = useState(null);

  const set = (patch) => setF(prev => ({ ...prev, ...patch }));
  const setLine = (i, patch) => setF(prev => ({ ...prev, lines: prev.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));

  const categories = useMemo(
    () => meta?.categories.filter(c => c.direction === f.kind) ?? [],
    [meta, f.kind]
  );
  const total = f.kind === 'virement'
    ? parseEuros(f.amount) ?? 0
    : f.lines.reduce((s, l) => s + (parseEuros(l.amount) ?? 0), 0);

  const changeKind = (kind) => {
    const allowed = TREASURIES[kind];
    set({ kind, treasury: allowed.includes(f.treasury) ? f.treasury : allowed[0], lines: f.lines.map(l => ({ ...l, category: '' })) });
  };

  const save = async (op) => {
    setBusy(true); setError(null);
    try {
      if (mode === 'create') {
        const created = await api.compta.create(op);
        const failed = [];
        for (const file of files) {
          try {
            const { blob, name } = await prepareFile(file);
            await uploadAttachment(created.id, blob, name);
          } catch (err) {
            failed.push(err.message);
          }
        }
        navigate(`/admin/compta/operations/${created.id}${failed.length ? '?justificatifs=echec' : ''}`);
      } else {
        await api.compta.correct(operationId, op);
        navigate(`/admin/compta/operations/${operationId}?corrigee=1`);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setConfirm(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const { op, error: invalid } = toPayload(f);
    if (invalid) { setError(invalid); return; }
    setError(null);

    if (mode === 'request') { setRequestOp(op); return; }

    setBusy(true);
    try {
      const { warnings } = await api.compta.check(op);
      setBusy(false);
      // Récapitulatif systématique pour une saisie : on relit avant d'enregistrer.
      setConfirm({ op, warnings });
    } catch (err) {
      setBusy(false);
      setError(err.message);
    }
  };

  if (metaError) return <Notice tone="error">{metaError}</Notice>;
  if (!meta) return null;

  const kinds = mode === 'create' ? ['depense', 'recette', 'virement'] : [f.kind];
  const label = (txt, htmlFor) => <label htmlFor={htmlFor} className="block text-sm font-semibold text-warm-700 mb-1.5">{txt}</label>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      {kinds.length > 1 && (
        <div role="radiogroup" aria-label="Type d'opération" className="inline-flex bg-white border border-warm-100 rounded-xl p-1">
          {kinds.map(k => (
            <button type="button" key={k} role="radio" aria-checked={f.kind === k} onClick={() => changeKind(k)}
              className={`px-4 py-2 rounded-lg font-nunito text-sm font-semibold transition-colors ${
                f.kind === k ? 'bg-orange-500 text-white' : 'text-warm-600 hover:text-warm-900'
              }`}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm-100 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            {label('Date', 'op-date')}
            <input id="op-date" type="date" required value={f.date} onChange={e => set({ date: e.target.value })} className={input} />
          </div>
          <div className="sm:col-span-2">
            {label('Libellé', 'op-label')}
            <input id="op-label" required maxLength={255} value={f.label} onChange={e => set({ label: e.target.value })}
              placeholder={f.kind === 'depense' ? 'Courses Lidl' : f.kind === 'recette' ? 'Vente repas du jeudi' : 'Dépôt des espèces'}
              className={input} />
          </div>
        </div>

        {f.kind === 'virement' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              {label('De', 'op-from')}
              <select id="op-from" value={f.from} onChange={e => set({ from: e.target.value })} className={input}>
                {TREASURIES.virement.map(t => <option key={t} value={t}>{meta.treasuries[t]}</option>)}
              </select>
            </div>
            <div>
              {label('Vers', 'op-to')}
              <select id="op-to" value={f.to} onChange={e => set({ to: e.target.value })} className={input}>
                {TREASURIES.virement.map(t => <option key={t} value={t}>{meta.treasuries[t]}</option>)}
                <option value="membre">Remboursement d'un membre</option>
              </select>
            </div>
            <div>
              {label('Montant', 'op-amount')}
              <input id="op-amount" inputMode="decimal" required value={f.amount} onChange={e => set({ amount: e.target.value })}
                placeholder="0,00" className={`${input} text-right tabular-nums`} />
            </div>
          </div>
        ) : null}

        {f.kind === 'virement' && f.to === 'membre' && (
          <div className="max-w-sm">
            {label('Membre remboursé', 'op-member')}
            <MemberPicker id="op-member" value={f.third_party} onChange={(v) => set({ third_party: v })} />
          </div>
        )}

        {f.kind !== 'virement' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {label(f.kind === 'recette' ? 'Encaissé sur' : 'Payé avec', 'op-treasury')}
                <select id="op-treasury" value={f.treasury} onChange={e => set({ treasury: e.target.value })} className={input}>
                  {TREASURIES[f.kind].map(t => <option key={t} value={t}>{meta.treasuries[t]}</option>)}
                </select>
              </div>
              <div>
                {label(f.treasury === 'membre' ? 'Membre qui a payé' : f.kind === 'depense' ? 'Fournisseur (facultatif)' : 'Payeur (facultatif)', 'op-third')}
                {f.treasury === 'membre' ? (
                  <MemberPicker id="op-third" value={f.third_party} onChange={(v) => set({ third_party: v })} />
                ) : (
                  <input id="op-third" maxLength={255} value={f.third_party} onChange={e => set({ third_party: e.target.value })} className={input} />
                )}
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-warm-700 mb-1.5">
                {f.lines.length > 1 ? 'Ventilation' : 'Catégorie et montant'}
              </legend>
              {f.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <select aria-label={`Catégorie ligne ${i + 1}`} value={l.category} onChange={e => setLine(i, { category: e.target.value })}
                    required className={`${input} col-span-12 sm:col-span-5`}>
                    <option value="">{f.kind === 'recette' ? 'Type de rentrée…' : 'Type de sortie…'}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <input aria-label={`Détail ligne ${i + 1}`} value={l.label} maxLength={255} onChange={e => setLine(i, { label: e.target.value })}
                    placeholder="Détail (facultatif)" className={`${input} col-span-7 sm:col-span-4`} />
                  <input aria-label={`Montant ligne ${i + 1}`} inputMode="decimal" required value={l.amount}
                    onChange={e => setLine(i, { amount: e.target.value })} placeholder="0,00"
                    className={`${input} col-span-4 sm:col-span-2 text-right tabular-nums`} />
                  <div className="col-span-1 flex justify-center pt-2.5">
                    {f.lines.length > 1 && (
                      <button type="button" aria-label={`Supprimer la ligne ${i + 1}`}
                        onClick={() => set({ lines: f.lines.filter((_, j) => j !== i) })}
                        className="text-warm-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => set({ lines: [...f.lines, emptyLine()] })}
                  className="text-sm font-semibold text-orange-700 hover:underline" disabled={f.lines.length >= 20}>
                  Ajouter une ligne
                </button>
                <p className="font-nunito text-sm text-warm-600">
                  Total <span className="font-bold text-warm-900 tabular-nums">{formatEuros(total)}</span>
                </p>
              </div>
            </fieldset>
          </>
        )}

        <div>
          {label('Notes (facultatif)', 'op-notes')}
          <textarea id="op-notes" rows={2} maxLength={2000} value={f.notes} onChange={e => set({ notes: e.target.value })} className={input} />
        </div>
      </div>

      {mode === 'create' && (
        <div className="bg-white rounded-2xl border border-warm-100 p-5">
          <p className="text-sm font-semibold text-warm-700 mb-1">Justificatifs</p>
          <p className="text-xs font-nunito text-warm-500 mb-3">
            Ticket de caisse, facture ou reçu. Photo ou PDF, 8 Mo maximum. Vous pourrez en ajouter plus tard.
          </p>
          <FilePicker files={files} onChange={setFiles} disabled={busy} />
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={btn.primary}>
          {busy ? 'Enregistrement…' : mode === 'request' ? 'Continuer' : mode === 'correct' ? 'Enregistrer la correction' : 'Vérifier et enregistrer'}
        </button>
        <button type="button" onClick={onCancel} className={btn.secondary}>Annuler</button>
      </div>

      {confirm && (
        <Modal title={mode === 'correct' ? 'Confirmer la correction' : 'Confirmer la saisie'} onClose={() => setConfirm(null)}>
          <div className="space-y-4">
            <dl className="text-sm font-nunito grid grid-cols-3 gap-y-2">
              <dt className="text-warm-500">Type</dt><dd className="col-span-2 text-warm-900">{KIND_LABELS[confirm.op.kind]}</dd>
              <dt className="text-warm-500">Date</dt><dd className="col-span-2 text-warm-900">{frDate(confirm.op.date)}</dd>
              <dt className="text-warm-500">Libellé</dt><dd className="col-span-2 text-warm-900">{confirm.op.label}</dd>
              <dt className="text-warm-500">Moyen</dt><dd className="col-span-2 text-warm-900">{treasuryText(confirm.op)}</dd>
              {confirm.op.lines?.map((l, i) => (
                <div key={i} className="contents">
                  <dt className="text-warm-500">{i === 0 ? 'Ventilation' : ''}</dt>
                  <dd className="col-span-2 text-warm-900">{categoryLabel(meta, l.category)} : {formatEuros(l.amount)}</dd>
                </div>
              ))}
              <dt className="text-warm-500">Total</dt>
              <dd className="col-span-2 text-warm-900 font-bold tabular-nums">
                {formatEuros(confirm.op.kind === 'virement' ? confirm.op.amount : confirm.op.lines.reduce((s, l) => s + l.amount, 0))}
              </dd>
              {mode === 'create' && (
                <>
                  <dt className="text-warm-500">Justificatifs</dt>
                  <dd className="col-span-2 text-warm-900">{files.length || 'aucun'}</dd>
                </>
              )}
            </dl>
            {confirm.warnings.map(w => <Notice key={w.code + w.message} tone="error">{w.message}</Notice>)}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirm(null)} className={btn.secondary}>Modifier</button>
              <button type="button" disabled={busy} onClick={() => save(confirm.op)} className={btn.primary}>
                {busy ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {requestOp && (
        <RequestDialog
          title="Demander une correction"
          summary={`${requestOp.label} — ${formatEuros(requestOp.kind === 'virement' ? requestOp.amount : requestOp.lines.reduce((s, l) => s + l.amount, 0))}`}
          onClose={() => setRequestOp(null)}
          onSubmit={async (reason) => {
            await api.requests.create({ type: 'entry.update', target_id: operationId, payload: requestOp, reason });
            navigate(`/admin/compta/operations/${operationId}?demande=1`);
          }} />
      )}
    </form>
  );
}
