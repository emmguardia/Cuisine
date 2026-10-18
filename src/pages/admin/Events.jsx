import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { navigate, onLinkClick } from '../../lib/router';
import { btn, input, Empty, Notice, PageTitle, TableSkeleton, Modal } from './ui';
import { formatEuros, frDate, todayIso, parseEuros, centsToInput } from './compta/money';
import { Amount, SummaryCard, useComptaMeta, categoryLabel } from './compta/shared';

function EventDialog({ event, onClose, onSaved }) {
  const [f, setF] = useState({ name: event?.name ?? '', date: event?.date ?? todayIso(), description: event?.description ?? '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const data = { name: f.name.trim(), date: f.date, description: f.description.trim() || null };
    try {
      const saved = event ? await api.evenements.update(event.id, data) : await api.evenements.create(data);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={event ? 'Modifier l\'événement' : 'Nouvel événement'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="ev-name" className="block text-sm font-semibold text-warm-700 mb-1.5">Nom</label>
            <input id="ev-name" required minLength={2} maxLength={150} value={f.name} placeholder="Vente de crêpes"
              onChange={e => setF({ ...f, name: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="ev-date" className="block text-sm font-semibold text-warm-700 mb-1.5">Date</label>
            <input id="ev-date" type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={input} />
          </div>
        </div>
        <div>
          <label htmlFor="ev-desc" className="block text-sm font-semibold text-warm-700 mb-1.5">Description (facultatif)</label>
          <textarea id="ev-desc" rows={2} maxLength={2000} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={input} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EventsList() {
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.evenements.list().then(d => setEvents(d.events)).catch(err => setError(err.message));
  }, []);

  const total = (events ?? []).reduce((s, e) => s + e.resultat, 0);

  return (
    <div className="space-y-6">
      <PageTitle title="Événements"
        subtitle="Ventes et événements : courses d'un côté, paiements reçus de l'autre. Ces regroupements n'écrivent rien en compta."
        actions={<button onClick={() => setCreating(true)} className={btn.primary}>Nouvel événement</button>} />
      {error && <Notice tone="error">{error}</Notice>}

      {!events ? <TableSkeleton cols={4} /> : events.length === 0 ? (
        <Empty message="Aucun événement pour l'instant." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Événements" value={events.length} />
            <SummaryCard label="Résultat cumulé" value={formatEuros(total, { sign: true })} tone={total < 0 ? 'negative' : 'positive'} />
          </div>
          <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
            <table className="table-cards w-full text-left text-sm font-nunito">
              <thead>
                <tr className="border-b border-warm-100 text-xs uppercase tracking-wide text-warm-500">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Événement</th>
                  <th className="px-4 py-3 font-semibold text-right">Rentrées</th>
                  <th className="px-4 py-3 font-semibold text-right">Dépenses</th>
                  <th className="px-4 py-3 font-semibold text-right">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} onClick={() => navigate(`/admin/evenements/${ev.id}`)}
                    className="border-b border-warm-50 last:border-none hover:bg-orange-50/60 cursor-pointer">
                    <td data-label="Date" className="px-4 py-3 whitespace-nowrap text-warm-600">{frDate(ev.date)}</td>
                    <td className="px-4 py-3">
                      <a href={`/admin/evenements/${ev.id}`} onClick={(e) => { e.stopPropagation(); onLinkClick(e, `/admin/evenements/${ev.id}`); }}
                        className="font-semibold text-warm-900 hover:underline">{ev.name}</a>
                      <span className="block text-xs text-warm-500">{ev.operations} opération{ev.operations > 1 ? 's' : ''} rattachée{ev.operations > 1 ? 's' : ''}</span>
                    </td>
                    <td data-label="Rentrées" className="px-4 py-3 text-right tabular-nums text-green-800">{formatEuros(ev.recettes)}</td>
                    <td data-label="Dépenses" className="px-4 py-3 text-right tabular-nums">{formatEuros(ev.depenses)}</td>
                    <td data-label="Résultat" className={`px-4 py-3 text-right tabular-nums font-bold ${ev.resultat < 0 ? 'text-red-700' : 'text-green-800'}`}>
                      {formatEuros(ev.resultat, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating && (
        <EventDialog onClose={() => setCreating(false)} onSaved={(ev) => navigate(`/admin/evenements/${ev.id}`)} />
      )}
    </div>
  );
}

/** Choix d'opérations à rattacher : autour de la date de l'événement, recherche libre. */
function LinkPicker({ event, onClose, onLinked }) {
  const { meta } = useComptaMeta();
  const shift = (iso, days) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const [range, setRange] = useState({ from: shift(event.date, -10), to: shift(event.date, 3), q: '' });
  const [ops, setOps] = useState(null);
  const [picked, setPicked] = useState({});   // id → montant saisi ('' = tout)
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const linked = useMemo(() => new Set(event.operations.map(o => o.origin_id)), [event]);

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(range).filter(([, v]) => v));
    const t = setTimeout(() => {
      api.compta.list(params)
        .then(d => setOps(d.operations.filter(o => ['recette', 'depense'].includes(o.kind) && !linked.has(o.origin_id))))
        .catch(err => setError(err.message));
    }, range.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [range, linked]);

  const toggle = (op) => setPicked(p => {
    const next = { ...p };
    if (op.id in next) delete next[op.id]; else next[op.id] = '';
    return next;
  });

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      for (const [id, txt] of Object.entries(picked)) {
        const amount = txt.trim() ? parseEuros(txt) : null;
        if (txt.trim() && (!amount || amount <= 0)) throw new Error('Montant affecté invalide');
        await api.evenements.link(event.id, id, amount);
      }
      onLinked();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Rattacher des opérations" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" aria-label="Du" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className={`${input} w-40`} />
          <span className="text-sm text-warm-400">au</span>
          <input type="date" aria-label="Au" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className={`${input} w-40`} />
          <input type="search" aria-label="Rechercher" placeholder="Rechercher" value={range.q} onChange={e => setRange({ ...range, q: e.target.value })} className={`${input} flex-1 min-w-[8rem]`} />
        </div>
        <p className="text-xs font-nunito text-warm-500">
          Laissez le montant vide pour rattacher toute l'opération, ou indiquez la part liée à l'événement.
        </p>
        <div className="max-h-80 overflow-y-auto border border-warm-100 rounded-xl divide-y divide-warm-50">
          {!ops ? <p className="p-4 text-sm text-warm-500">Chargement…</p> : ops.length === 0 ? (
            <p className="p-4 text-sm text-warm-500">Aucune opération disponible sur cette période.</p>
          ) : ops.map(op => (
            <label key={op.id} className="flex items-center gap-3 px-3 py-2 text-sm font-nunito cursor-pointer hover:bg-orange-50/60">
              <input type="checkbox" checked={op.id in picked} onChange={() => toggle(op)} className="accent-orange-500" />
              <span className="w-20 text-warm-500 flex-shrink-0">{frDate(op.date)}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-warm-900">{op.label}</span>
                <span className="block text-xs text-warm-500 truncate">{op.categories.map(c => categoryLabel(meta, c)).join(', ')}</span>
              </span>
              <Amount kind={op.kind} cents={op.total} />
              {op.id in picked && (
                <input aria-label="Montant affecté" inputMode="decimal" placeholder={centsToInput(op.total)} value={picked[op.id]}
                  onClick={e => e.preventDefault()} onChange={e => setPicked(p => ({ ...p, [op.id]: e.target.value }))}
                  className="w-20 px-2 py-1 border border-warm-200 rounded-lg text-right text-sm" />
              )}
            </label>
          ))}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="button" disabled={busy || !Object.keys(picked).length} onClick={submit} className={btn.primary}>
            {busy ? 'Rattachement…' : `Rattacher ${Object.keys(picked).length || ''}`.trim()}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EventDetail({ id }) {
  const { meta } = useComptaMeta();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api.evenements.get(id).then(setEvent).catch(err => setError(err.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!event) return <TableSkeleton cols={4} />;

  const unlink = async (op) => {
    if (!confirm(`Détacher « ${op.label} » de l'événement ? L'opération reste en compta.`)) return;
    try { setEvent(await api.evenements.unlink(event.id, op.origin_id)); } catch (err) { setError(err.message); }
  };
  const remove = async () => {
    if (!confirm(`Supprimer l'événement « ${event.name} » ? Les opérations restent en compta.`)) return;
    try { await api.evenements.remove(event.id); navigate('/admin/evenements'); } catch (err) { setError(err.message); }
  };

  const section = (title, kind) => {
    const rows = event.operations.filter(o => o.kind === kind);
    return (
      <section className="bg-white rounded-2xl border border-warm-100 p-5">
        <h2 className="font-nunito font-semibold text-warm-900 mb-3">{title}</h2>
        {rows.length === 0 ? <p className="text-sm font-nunito text-warm-500">Aucune opération rattachée.</p> : (
          <ul className="divide-y divide-warm-50">
            {rows.map(o => (
              <li key={o.origin_id} className="py-2.5 flex items-center gap-3 text-sm font-nunito">
                <span className="w-20 text-warm-500 flex-shrink-0">{frDate(o.date)}</span>
                <a href={`/admin/compta/operations/${o.entry_id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${o.entry_id}`)}
                  className={`flex-1 min-w-0 truncate hover:underline ${o.counted ? 'text-warm-900' : 'text-warm-400 line-through'}`}>
                  {o.label} <span className="text-xs text-warm-500 no-underline">{o.number}</span>
                </a>
                <span className="tabular-nums text-right">
                  {formatEuros(o.amount)}
                  {o.partial && <span className="block text-xs text-warm-500">sur {formatEuros(o.total)}</span>}
                </span>
                <button onClick={() => unlink(o)} className="text-xs font-semibold text-red-600 hover:underline">Détacher</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/evenements" onClick={(e) => onLinkClick(e, '/admin/evenements')}
          className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour aux événements</a>
      </div>
      <PageTitle title={event.name} subtitle={`${frDate(event.date)}${event.description ? ` · ${event.description}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className={btn.secondary}>Modifier</button>
            <button onClick={remove} className={btn.danger}>Supprimer</button>
            <button onClick={() => setPicking(true)} className={btn.primary}>Rattacher des opérations</button>
          </div>
        } />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Rentrées" value={formatEuros(event.recettes)} tone="positive" />
        <SummaryCard label="Dépenses" value={formatEuros(event.depenses)} />
        <SummaryCard label="Résultat" value={formatEuros(event.resultat, { sign: true })} tone={event.resultat < 0 ? 'negative' : 'positive'}
          hint={event.depenses > 0 ? `Marge : ${Math.round((event.resultat / Math.max(event.recettes, 1)) * 100)} % des rentrées` : null} />
      </div>

      {section('Rentrées (paiements reçus)', 'recette')}
      {section('Dépenses (courses, matériel)', 'depense')}

      {meta && event.operations.some(o => !o.counted) && (
        <p className="text-xs font-nunito text-warm-500">Les opérations barrées ont été annulées en compta et ne comptent plus.</p>
      )}

      {picking && <LinkPicker event={event} onClose={() => setPicking(false)} onLinked={() => { setPicking(false); load(); }} />}
      {editing && <EventDialog event={event} onClose={() => setEditing(false)} onSaved={(ev) => { setEditing(false); setEvent(ev); }} />}
    </div>
  );
}
