import { useCallback, useEffect, useState } from 'react';
import { api, uploadEquipmentPhoto } from '../../lib/api';
import { navigate, onLinkClick } from '../../lib/router';
import { btn, input, Empty, Notice, PageTitle, TableSkeleton, Modal, formatDateTime } from './ui';
import { formatEuros, centsToInput, parseEuros, frDate, todayIso } from './compta/money';
import { prepareFile, SummaryCard } from './compta/shared';

const CONDITION_CLS = {
  neuf: 'bg-green-100 text-green-800', bon: 'bg-warm-100 text-warm-700',
  use: 'bg-orange-100 text-orange-800', hs: 'bg-red-100 text-red-700',
};
const EXIT = { perdu: 'Perdu', casse: 'Cassé', jete: 'Jeté', donne: 'Donné' };

function useRefs() {
  const [refs, setRefs] = useState(null);
  useEffect(() => {
    api.materiel.list({ status: 'actif' }).then(d => setRefs({ categories: d.categories, conditions: d.conditions, kinds: d.kinds }))
      .catch(() => setRefs(null));
  }, []);
  return refs;
}

const label = (txt, id) => <label htmlFor={id} className="block text-sm font-semibold text-warm-700 mb-1.5">{txt}</label>;

/* ─── Formulaire d'une fiche ─────────────────────────────────────────── */
function EquipmentDialog({ item, refs, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: item?.name ?? '', category: item?.category ?? 'ustensiles', item_condition: item?.item_condition ?? 'bon',
    provenance: item?.provenance ?? 'achat', purchase_date: item?.purchase_date ?? '',
    unit_price: item?.unit_price != null ? centsToInput(item.unit_price) : '', donor: item?.donor ?? '',
    donated_value: item?.donated_value != null ? centsToInput(item.donated_value) : '', notes: item?.notes ?? '',
    quantity: '1',
  }));
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF(p => ({ ...p, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const cents = (v) => (v.trim() ? parseEuros(v) : null);
    const data = {
      name: f.name.trim(), category: f.category, item_condition: f.item_condition, provenance: f.provenance,
      purchase_date: f.provenance === 'achat' ? f.purchase_date || null : null,
      unit_price: f.provenance === 'achat' ? cents(f.unit_price) : null,
      donor: f.provenance === 'don' ? f.donor.trim() || null : null,
      donated_value: f.provenance === 'don' ? cents(f.donated_value) : null,
      notes: f.notes.trim() || null,
    };
    if ([data.unit_price, data.donated_value].some(v => Number.isNaN(v) || (v != null && v < 0))) { setError('Montant invalide (ex. 12,50).'); return; }
    if (!item) {
      const q = Number(f.quantity);
      if (!Number.isInteger(q) || q < 1) { setError('Quantité invalide.'); return; }
      data.quantity = q;
    }
    setBusy(true); setError(null);
    try {
      const saved = item ? await api.materiel.update(item.id, data) : await api.materiel.create(data);
      if (photo) {
        const { blob } = await prepareFile(photo);
        await uploadEquipmentPhoto(saved.id, blob);
      }
      onSaved(saved);
    } catch (err) {
      setError(err.details?.length ? `${err.message} : ${err.details.map(d => d.message).join(', ')}` : err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={item ? 'Modifier le matériel' : 'Ajouter du matériel'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">{label('Nom', 'eq-name')}
            <input id="eq-name" required minLength={2} maxLength={150} value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Fouet inox" className={input} /></div>
          {!item && <div>{label('Quantité', 'eq-qty')}
            <input id="eq-qty" type="number" min={1} max={10000} required value={f.quantity} onChange={e => set({ quantity: e.target.value })} className={`${input} text-right`} /></div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>{label('Catégorie', 'eq-cat')}
            <select id="eq-cat" value={f.category} onChange={e => set({ category: e.target.value })} className={input}>
              {Object.entries(refs.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div>{label('État', 'eq-cond')}
            <select id="eq-cond" value={f.item_condition} onChange={e => set({ item_condition: e.target.value })} className={input}>
              {Object.entries(refs.conditions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
        </div>
        <div>{label('Provenance', 'eq-prov')}
          <select id="eq-prov" value={f.provenance} onChange={e => set({ provenance: e.target.value })} className={input}>
            <option value="achat">Acheté</option>
            <option value="don">Donné au club</option>
          </select></div>
        {f.provenance === 'achat' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>{label('Date d\'achat (facultatif)', 'eq-date')}<input id="eq-date" type="date" value={f.purchase_date} onChange={e => set({ purchase_date: e.target.value })} className={input} /></div>
            <div>{label('Prix unitaire (facultatif)', 'eq-price')}<input id="eq-price" inputMode="decimal" value={f.unit_price} onChange={e => set({ unit_price: e.target.value })} placeholder="0,00" className={`${input} text-right`} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>{label('Donné par (facultatif)', 'eq-donor')}<input id="eq-donor" maxLength={150} value={f.donor} onChange={e => set({ donor: e.target.value })} className={input} /></div>
            <div>{label('Valeur estimée (facultatif)', 'eq-val')}<input id="eq-val" inputMode="decimal" value={f.donated_value} onChange={e => set({ donated_value: e.target.value })} placeholder="0,00" className={`${input} text-right`} /></div>
          </div>
        )}
        <div>{label('Notes (facultatif)', 'eq-notes')}<textarea id="eq-notes" rows={2} maxLength={2000} value={f.notes} onChange={e => set({ notes: e.target.value })} className={input} /></div>
        <div>{label(item?.has_photo ? 'Remplacer la photo (facultatif)' : 'Photo (facultatif)', 'eq-photo')}
          <input id="eq-photo" type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-warm-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700" /></div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Liste ──────────────────────────────────────────────────────────── */
export function EquipmentList() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ q: '', category: '', status: 'actif' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [checks, setChecks] = useState([]);

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.materiel.list(params).then(setData).catch(err => setError(err.message));
  }, [filters]);
  useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);
  useEffect(() => { api.materiel.checks().then(d => setChecks(d.checks)).catch(() => {}); }, []);

  const startCheck = async () => {
    try {
      const c = await api.materiel.startCheck(todayIso());
      navigate(`/admin/materiel/inventaire/${c.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const s = data?.summary;
  return (
    <div className="space-y-6">
      <PageTitle title="Matériel"
        subtitle="Ce que le club possède, pour repérer ce qui se perd ou se casse."
        actions={
          <div className="flex flex-wrap gap-2">
            {s?.controle_en_cours
              ? <a href={`/admin/materiel/inventaire/${s.controle_en_cours}`} onClick={(e) => onLinkClick(e, `/admin/materiel/inventaire/${s.controle_en_cours}`)} className={btn.secondary}>Reprendre le contrôle en cours</a>
              : <button onClick={startCheck} className={btn.secondary}>Faire un contrôle d'inventaire</button>}
            <button onClick={() => setAdding(true)} className={btn.primary}>Ajouter du matériel</button>
          </div>
        } />
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Objets" value={s.objets} hint={`${s.fiches} fiche${s.fiches > 1 ? 's' : ''}`} />
          <SummaryCard label="Hors service" value={s.hors_service} tone={s.hors_service ? 'negative' : 'default'} />
          <SummaryCard label="Dernier contrôle" value={s.dernier_controle ? frDate(s.dernier_controle) : 'Jamais'} />
          <SummaryCard label="Manquants au dernier contrôle" value={s.manquants_dernier_controle} tone={s.manquants_dernier_controle ? 'negative' : 'default'} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="search" aria-label="Rechercher" placeholder="Rechercher" value={filters.q}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={`${input} sm:flex-1`} />
        <select aria-label="Catégorie" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} className={`${input} sm:w-56`}>
          <option value="">Toutes les catégories</option>
          {data && Object.entries(data.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Statut" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={`${input} sm:w-48`}>
          <option value="actif">Dans l'inventaire</option>
          <option value="sorti">Sortis (perdus, cassés…)</option>
        </select>
      </div>

      {!data ? <TableSkeleton cols={4} /> : data.items.length === 0 ? (
        <Empty message={filters.status === 'sorti' ? 'Aucun matériel sorti de l\'inventaire.' : 'Aucun matériel pour l\'instant. Commencez par « Ajouter du matériel ».'} />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.items.map(it => (
            <li key={it.id}>
              <a href={`/admin/materiel/${it.id}`} onClick={(e) => onLinkClick(e, `/admin/materiel/${it.id}`)}
                className="block bg-white rounded-2xl border border-warm-100 overflow-hidden hover:border-orange-300 transition-colors">
                <div className="aspect-[4/3] bg-warm-50 flex items-center justify-center">
                  {it.has_photo
                    ? <img src={api.materiel.photoUrl(it.id, it.updated_at)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    : <span className="font-nunito text-xs text-warm-400">{data.categories[it.category]}</span>}
                </div>
                <div className="p-3 font-nunito">
                  <p className="font-semibold text-warm-900 text-sm leading-tight">{it.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-warm-900 tabular-nums">{it.status === 'sorti' ? EXIT[it.exit_reason] : `× ${it.expected_qty}`}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONDITION_CLS[it.item_condition]}`}>{data.conditions[it.item_condition]}</span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {checks.length > 0 && (
        <section>
          <h2 className="font-nunito font-semibold text-warm-900 mb-3">Contrôles d'inventaire</h2>
          <ul className="bg-white rounded-2xl border border-warm-100 divide-y divide-warm-50">
            {checks.map(c => (
              <li key={c.id}>
                <a href={`/admin/materiel/inventaire/${c.id}`} onClick={(e) => onLinkClick(e, `/admin/materiel/inventaire/${c.id}`)}
                  className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-nunito text-sm hover:bg-orange-50/60">
                  <span className="text-warm-900 font-semibold w-28">{frDate(c.check_date)}</span>
                  <span className="text-warm-600 flex-1">
                    {c.status === 'en_cours' ? `En cours : ${c.comptees}/${c.lignes} comptés` : `Validé par ${c.validated_by_name}`}
                  </span>
                  {c.status === 'valide' && (
                    <span className={c.manquants ? 'text-red-700 font-semibold' : 'text-green-800'}>
                      {c.manquants ? `${c.manquants} manquant${c.manquants > 1 ? 's' : ''}` : 'Rien ne manquait'}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adding && data && (
        <EquipmentDialog refs={data} onClose={() => setAdding(false)} onSaved={(saved) => navigate(`/admin/materiel/${saved.id}`)} />
      )}
    </div>
  );
}

/* ─── Demande : quantité ou sortie ───────────────────────────────────── */
function QuantityRequestDialog({ item, mode, onClose, onSent }) {
  const [kind, setKind] = useState(mode === 'retire' ? 'casse' : 'perte');
  const [count, setCount] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const KINDS = { perte: 'Perte', casse: 'Casse', rebut: 'Mise au rebut', achat: 'Achat complémentaire', retrouve: 'Retrouvé', correction: 'Correction' };
  const sign = ['achat', 'retrouve'].includes(kind) ? 1 : ['perte', 'casse', 'rebut'].includes(kind) ? -1 : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) { setError('Indiquez un motif (5 caractères minimum).'); return; }
    setBusy(true); setError(null);
    try {
      if (mode === 'retire') {
        await api.requests.create({ type: 'equipment.retire', target_id: item.id, payload: { exit_reason: kind }, reason: reason.trim() });
      } else {
        const n = parseInt(count, 10);
        const delta = sign === 0 ? n : sign * Math.abs(n);
        if (!Number.isInteger(n) || n === 0) throw new Error('Nombre invalide');
        await api.requests.create({ type: 'equipment.adjust', target_id: item.id, payload: { kind, delta }, reason: reason.trim() });
      }
      onSent();
    } catch (err) {
      setError(err.details?.length ? err.details.map(d => d.message).join(', ') : err.message);
      setBusy(false);
    }
  };

  const n = parseInt(count, 10) || 0;
  const after = mode === 'retire' ? 0 : item.expected_qty + (sign === 0 ? n : sign * Math.abs(n));
  return (
    <Modal title={mode === 'retire' ? 'Sortir de l\'inventaire' : 'Changer la quantité'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'retire' ? (
          <div>{label('Raison', 'rq-exit')}
            <select id="rq-exit" value={kind} onChange={e => setKind(e.target.value)} className={input}>
              {Object.entries(EXIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{label('Mouvement', 'rq-kind')}
              <select id="rq-kind" value={kind} onChange={e => setKind(e.target.value)} className={input}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div>{label(sign === 0 ? 'Écart (+ / -)' : 'Nombre', 'rq-count')}
              <input id="rq-count" inputMode="numeric" value={count} onChange={e => setCount(e.target.value)} className={`${input} text-right`} /></div>
          </div>
        )}
        <div className="px-4 py-3 bg-warm-50 rounded-xl text-sm font-nunito text-warm-800">
          {item.name} : {item.expected_qty} → <strong>{Math.max(after, 0)}</strong>
          {mode === 'retire' && ' (la fiche reste consultable dans « Sortis »)'}
        </div>
        <p className="text-sm font-nunito text-warm-600">Appliqué après validation par un autre membre du bureau.</p>
        <div>{label('Motif', 'rq-reason')}
          <textarea id="rq-reason" rows={2} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className={input} /></div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Fiche ──────────────────────────────────────────────────────────── */
export function EquipmentDetail({ id }) {
  const refs = useRefs();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [dialog, setDialog] = useState(null);   // 'edit' | 'adjust' | 'retire'

  const load = useCallback(() => { api.materiel.get(id).then(setItem).catch(err => setError(err.message)); }, [id]);
  useEffect(load, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!item || !refs) return <TableSkeleton cols={3} />;
  const active = item.status === 'actif';

  return (
    <div className="space-y-6">
      <a href="/admin/materiel" onClick={(e) => onLinkClick(e, '/admin/materiel')}
        className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour au matériel</a>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-72 flex-shrink-0">
          <div className="aspect-[4/3] bg-warm-50 rounded-2xl border border-warm-100 overflow-hidden flex items-center justify-center">
            {item.has_photo
              ? <img src={api.materiel.photoUrl(item.id, item.updated_at)} alt={item.name} className="w-full h-full object-cover" />
              : <span className="font-nunito text-sm text-warm-400">Pas de photo</span>}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">{refs.categories[item.category]}</p>
          <h1 className="font-playfair text-2xl md:text-3xl font-semibold text-warm-900">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-nunito text-2xl font-bold text-warm-900 tabular-nums">{active ? `× ${item.expected_qty}` : `Sorti : ${EXIT[item.exit_reason].toLowerCase()}`}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${CONDITION_CLS[item.item_condition]}`}>{refs.conditions[item.item_condition]}</span>
          </div>
          <dl className="font-nunito text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div><dt className="text-warm-500">Provenance</dt><dd className="text-warm-900">
              {item.provenance === 'don' ? `Don${item.donor ? ` de ${item.donor}` : ''}${item.donated_value != null ? ` (valeur ${formatEuros(item.donated_value)})` : ''}`
                : `Achat${item.purchase_date ? ` du ${frDate(item.purchase_date)}` : ''}${item.unit_price != null ? `, ${formatEuros(item.unit_price)} l'unité` : ''}`}
            </dd></div>
            {item.entry_id && <div><dt className="text-warm-500">Dépense liée</dt><dd>
              <a href={`/admin/compta/operations/${item.entry_id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${item.entry_id}`)} className="text-orange-700 hover:underline">{item.entry_number} — {item.entry_label}</a></dd></div>}
            {item.notes && <div className="sm:col-span-2"><dt className="text-warm-500">Notes</dt><dd className="text-warm-900 whitespace-pre-line">{item.notes}</dd></div>}
          </dl>
          {active && !item.pending_request && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => setDialog('edit')} className={btn.secondary}>Modifier</button>
              <button onClick={() => setDialog('adjust')} className={btn.small}>Changer la quantité</button>
              <button onClick={() => setDialog('retire')} className={btn.danger}>Sortir de l'inventaire</button>
            </div>
          )}
        </div>
      </div>

      {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
      {item.pending_request && (
        <Notice>Une demande est en attente sur ce matériel ({item.pending_request.requested_by_name}).{' '}
          <a href="/admin/demandes" onClick={(e) => onLinkClick(e, '/admin/demandes')} className="font-semibold underline">Voir les demandes</a></Notice>
      )}

      <section className="bg-white rounded-2xl border border-warm-100 p-5">
        <h2 className="font-nunito font-semibold text-warm-900 mb-3">Historique</h2>
        <ul className="divide-y divide-warm-50 font-nunito text-sm">
          {item.movements.map(m => (
            <li key={m.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-warm-500 w-36">{formatDateTime(m.created_at)}</span>
              <span className="text-warm-900 font-semibold w-36">{refs.kinds[m.kind]}</span>
              <span className={`tabular-nums font-semibold w-12 ${m.qty_delta < 0 ? 'text-red-700' : 'text-green-800'}`}>{m.qty_delta > 0 ? '+' : ''}{m.qty_delta}</span>
              <span className="text-warm-600 flex-1">{m.reason ?? ''}{m.created_by_name ? ` · ${m.created_by_name}` : ''}</span>
            </li>
          ))}
        </ul>
      </section>

      {dialog === 'edit' && <EquipmentDialog item={item} refs={refs} onClose={() => setDialog(null)}
        onSaved={() => { setDialog(null); setMessage('Fiche mise à jour.'); load(); }} />}
      {(dialog === 'adjust' || dialog === 'retire') && <QuantityRequestDialog item={item} mode={dialog} onClose={() => setDialog(null)}
        onSent={() => { setDialog(null); setMessage('Demande envoyée. Elle sera appliquée après validation par un autre membre du bureau.'); load(); }} />}
    </div>
  );
}

/* ─── Contrôle d'inventaire (pensé pour le téléphone) ────────────────── */
export function InventoryCheck({ id }) {
  const refs = useRefs();
  const [check, setCheck] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = useCallback(() => { api.materiel.getCheck(id).then(setCheck).catch(err => setError(err.message)); }, [id]);
  useEffect(load, [load]);

  const save = async (line, patch) => {
    const next = { counted_qty: line.counted_qty, resolution: line.resolution ?? null, ...patch };
    if (next.counted_qty == null) {
      // Champ vidé pendant la saisie : rien à enregistrer pour l'instant.
      setCheck(c => ({ ...c, lines: c.lines.map(l => l.equipment_id === line.equipment_id ? { ...l, counted_qty: null, ecart: null } : l) }));
      return;
    }
    if (next.counted_qty < 0) return;
    if (next.counted_qty === line.expected_qty) next.resolution = null;
    setCheck(c => ({ ...c, lines: c.lines.map(l => l.equipment_id === line.equipment_id
      ? { ...l, ...next, ecart: next.counted_qty - l.expected_qty } : l) }));
    try {
      await api.materiel.setLine(id, line.equipment_id, next);
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const validate = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.materiel.validate(id);
      setDone(r.ecarts);
      setCheck(r.check);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const abandon = async () => {
    if (!confirm('Abandonner ce contrôle ? Rien ne sera appliqué.')) return;
    try { await api.materiel.abandon(id); navigate('/admin/materiel'); } catch (err) { setError(err.message); }
  };

  if (!check || !refs) return error ? <Notice tone="error">{error}</Notice> : <TableSkeleton cols={3} />;
  const open = check.status === 'en_cours';
  const counted = check.lines.filter(l => l.counted_qty != null).length;
  const gaps = check.lines.filter(l => l.ecart != null && l.ecart !== 0);

  return (
    <div className="space-y-5">
      <a href="/admin/materiel" onClick={(e) => onLinkClick(e, '/admin/materiel')}
        className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour au matériel</a>
      <PageTitle title={`Contrôle du ${frDate(check.check_date)}`}
        subtitle={open ? `${counted}/${check.lines.length} comptés · ${gaps.length} écart${gaps.length > 1 ? 's' : ''}. Chaque saisie est enregistrée tout de suite.`
          : check.status === 'valide' ? `Validé par ${check.validated_by_name} le ${formatDateTime(check.validated_at)}` : 'Abandonné'} />
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
      {done != null && <Notice tone="success">Contrôle validé : {done} écart{done > 1 ? 's' : ''} appliqué{done > 1 ? 's' : ''} au matériel.</Notice>}

      <ul className="space-y-2">
        {check.lines.map(l => (
          <li key={l.equipment_id} className={`bg-white rounded-2xl border p-3 ${l.ecart ? 'border-orange-300' : 'border-warm-100'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="w-10 h-10 rounded-xl bg-warm-50 overflow-hidden flex-shrink-0">
                {l.has_photo && <img src={api.materiel.photoUrl(l.equipment_id)} alt="" loading="lazy" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-[9rem] font-nunito">
                <p className="font-semibold text-warm-900 text-sm">{l.name}</p>
                <p className="text-xs text-warm-500">Attendu : {l.expected_qty}</p>
              </div>
              {open ? (
                <div className="flex items-center gap-1 ml-auto">
                  <button type="button" aria-label={`Un de moins : ${l.name}`} onClick={() => save(l, { counted_qty: Math.max(0, (l.counted_qty ?? l.expected_qty) - 1) })}
                    className="w-10 h-10 rounded-xl border border-warm-200 text-lg font-bold text-warm-700">−</button>
                  <input aria-label={`Quantité comptée : ${l.name}`} inputMode="numeric" value={l.counted_qty ?? ''} placeholder="?"
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); save(l, { counted_qty: v === '' ? null : Number(v) }); }}
                    className="w-14 h-10 text-center border border-warm-200 rounded-xl font-bold tabular-nums" />
                  <button type="button" aria-label={`Un de plus : ${l.name}`} onClick={() => save(l, { counted_qty: (l.counted_qty ?? l.expected_qty) + 1 })}
                    className="w-10 h-10 rounded-xl border border-warm-200 text-lg font-bold text-warm-700">+</button>
                  {l.counted_qty == null && (
                    <button type="button" onClick={() => save(l, { counted_qty: l.expected_qty })}
                      className="ml-1 px-3 h-10 rounded-xl bg-green-50 text-green-800 text-xs font-semibold">Tout est là</button>
                  )}
                </div>
              ) : (
                <span className="font-nunito font-bold tabular-nums">{l.counted_qty ?? '—'}</span>
              )}
            </div>
            {l.ecart != null && l.ecart !== 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 font-nunito text-sm">
                <span className={`font-semibold ${l.ecart < 0 ? 'text-red-700' : 'text-green-800'}`}>
                  {l.ecart < 0 ? `${-l.ecart} manquant${l.ecart < -1 ? 's' : ''}` : `${l.ecart} en trop`}
                </span>
                {open && (l.ecart < 0 ? ['perdu', 'casse', 'a_recompter'] : ['retrouve', 'a_recompter']).map(r => (
                  <button key={r} type="button" onClick={() => save(l, { resolution: r })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${l.resolution === r ? 'bg-orange-500 text-white border-orange-500' : 'border-warm-200 text-warm-700'}`}>
                    {{ perdu: 'Perdu', casse: 'Cassé', retrouve: 'Retrouvé', a_recompter: 'À recompter' }[r]}
                  </button>
                ))}
                {!open && l.resolution && <span className="text-warm-600">{{ perdu: 'perdu', casse: 'cassé', retrouve: 'retrouvé', a_recompter: 'non appliqué (à recompter)' }[l.resolution]}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>

      {open && (
        <div className="flex flex-wrap gap-3 sticky bottom-3">
          <button onClick={validate} disabled={busy} className={`${btn.primary} shadow-lg`}>
            {busy ? 'Validation…' : 'Valider le contrôle'}
          </button>
          <button onClick={abandon} className={`${btn.secondary} bg-white`}>Abandonner</button>
        </div>
      )}
    </div>
  );
}
