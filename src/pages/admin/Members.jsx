import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { btn, input, Empty, Notice, PageTitle, TableSkeleton, Modal } from './ui';
import { formatEuros, centsToInput, parseEuros, frDate, todayIso } from './compta/money';

export const CHANNEL_LABELS = {
  helloasso: 'HelloAsso',
  sumup:     'SumUp',
  virement:  'Virement',
  especes:   'Espèces',
  autre:     'Autre',
};

function currentSeason() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;   // saison à partir d'août
  return `${y}-${y + 1}`;
}

const EMPTY = () => ({
  last_name: '', first_name: '', email: '', school_email: '', joined_on: todayIso(), season: currentSeason(),
  amount: '7,00', tarif: 'Etudiant Quest', channel: 'sumup', notes: '',
});

function MemberDialog({ member, onClose, onSaved }) {
  const [f, setF] = useState(() => member
    ? { ...member, email: member.email ?? '', school_email: member.school_email ?? '', amount: centsToInput(member.amount), tarif: member.tarif ?? '', notes: member.notes ?? '' }
    : EMPTY());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF(prev => ({ ...prev, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseEuros(f.amount);
    if (amount == null || amount < 0) { setError('Montant invalide (ex. 7,00).'); return; }
    const data = {
      last_name: f.last_name.trim(), first_name: f.first_name.trim(), email: f.email.trim() || null,
      school_email: f.school_email.trim() || null,
      joined_on: f.joined_on, season: f.season.trim(), amount, tarif: f.tarif.trim() || null,
      channel: f.channel, notes: f.notes.trim() || null,
    };
    setBusy(true); setError(null);
    try {
      if (member) await api.membres.update(member.id, data);
      else        await api.membres.create(data);
      onSaved(member ? 'Adhérent mis à jour.' : `${data.first_name} ${data.last_name} ajouté(e).`);
    } catch (err) {
      setError(err.details?.length ? `${err.message} : ${err.details.map(d => `${d.champ} ${d.message}`).join(', ')}` : err.message);
      setBusy(false);
    }
  };

  const label = (txt, id) => <label htmlFor={id} className="block text-sm font-semibold text-warm-700 mb-1.5">{txt}</label>;
  return (
    <Modal title={member ? 'Modifier un adhérent' : 'Ajouter un adhérent'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>{label('Nom', 'm-last')}<input id="m-last" required maxLength={100} value={f.last_name} onChange={e => set({ last_name: e.target.value })} className={input} /></div>
          <div>{label('Prénom', 'm-first')}<input id="m-first" required maxLength={100} value={f.first_name} onChange={e => set({ first_name: e.target.value })} className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>{label('Email (facultatif)', 'm-email')}<input id="m-email" type="email" maxLength={255} value={f.email} onChange={e => set({ email: e.target.value })} className={input} /></div>
          <div>{label('Mail Guardia (facultatif)', 'm-school')}<input id="m-school" type="email" maxLength={255} placeholder="prenom.nom@guardiaschool.fr" value={f.school_email} onChange={e => set({ school_email: e.target.value })} className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>{label('Date d\'adhésion', 'm-date')}<input id="m-date" type="date" required value={f.joined_on} onChange={e => set({ joined_on: e.target.value })} className={input} /></div>
          <div>{label('Saison', 'm-season')}<input id="m-season" required pattern="\d{4}-\d{4}" value={f.season} onChange={e => set({ season: e.target.value })} className={input} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>{label('Montant', 'm-amount')}<input id="m-amount" inputMode="decimal" required value={f.amount} onChange={e => set({ amount: e.target.value })} className={`${input} text-right`} /></div>
          <div>{label('Payé par', 'm-channel')}
            <select id="m-channel" value={f.channel} onChange={e => set({ channel: e.target.value })} className={input}>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>{label('Tarif', 'm-tarif')}<input id="m-tarif" maxLength={100} value={f.tarif} onChange={e => set({ tarif: e.target.value })} className={input} /></div>
        </div>
        <div>{label('Notes (facultatif)', 'm-notes')}<textarea id="m-notes" rows={2} maxLength={1000} value={f.notes} onChange={e => set({ notes: e.target.value })} className={input} /></div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Saisie rapide du mail Guardia depuis la liste. */
function SchoolEmailCell({ member, onSaved, onError }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (member.school_email && !editing) {
    return (
      <button type="button" onClick={() => { setValue(member.school_email); setEditing(true); }}
        className="text-left text-warm-700 hover:underline" title="Modifier le mail Guardia">{member.school_email}</button>
    );
  }
  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(''); setEditing(true); }}
        className="text-xs font-semibold text-orange-700 hover:underline">Ajouter</button>
    );
  }
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.membres.setSchoolEmail(member.id, value.trim());
      setEditing(false);
      onSaved();
    } catch (err) {
      onError(err.details?.[0]?.message ?? err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <input type="email" autoFocus aria-label={`Mail Guardia de ${member.first_name} ${member.last_name}`}
        placeholder="prenom.nom@guardiaschool.fr" value={value} onChange={e => setValue(e.target.value)}
        className="w-56 px-2 py-1 border border-warm-200 rounded-lg text-sm" />
      <button type="submit" disabled={busy} className="text-xs font-semibold text-orange-700 hover:underline">OK</button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-warm-500 hover:underline">Annuler</button>
    </form>
  );
}

export default function Members() {
  const [data, setData] = useState(null);
  const [season, setSeason] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);   // null | 'new' | membre
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    const params = Object.fromEntries(Object.entries({ season, q }).filter(([, v]) => v));
    api.membres.list(params).then(setData).catch(err => setError(err.message));
  };
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [season, q]);

  const totals = useMemo(() => {
    const list = data?.members ?? [];
    const byChannel = {};
    for (const m of list) byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
    return { count: list.length, amount: list.reduce((s, m) => s + m.amount, 0), byChannel };
  }, [data]);

  const addToTeam = async (m) => {
    try {
      await api.membres.addToTeam(m.id);
      setMessage(`${m.first_name} ${m.last_name} apparaît maintenant sur la page Notre équipe (ajoutez sa photo dans Équipe).`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (m) => {
    if (!confirm(`Supprimer ${m.first_name} ${m.last_name} de la liste des adhérents ? Le paiement reste en compta.`)) return;
    try {
      await api.membres.remove(m.id);
      setMessage('Adhérent supprimé.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Adhérents"
        subtitle={data ? `${totals.count} adhérent${totals.count > 1 ? 's' : ''} · ${formatEuros(totals.amount)} · `
          + Object.entries(totals.byChannel).map(([k, n]) => `${n} ${CHANNEL_LABELS[k]}`).join(', ') : null}
        actions={<button onClick={() => setEditing('new')} className={btn.primary}>Ajouter un adhérent</button>} />

      {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="m-q">Rechercher</label>
        <input id="m-q" type="search" placeholder="Rechercher un nom ou un email" value={q} onChange={e => setQ(e.target.value)} className={`${input} sm:flex-1`} />
        <label className="sr-only" htmlFor="m-s">Saison</label>
        <select id="m-s" value={season} onChange={e => setSeason(e.target.value)} className={`${input} sm:w-48`}>
          <option value="">Toutes les saisons</option>
          {data?.seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!data ? <TableSkeleton cols={5} /> : data.members.length === 0 ? (
        <Empty message="Aucun adhérent pour ces critères." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
          <table className="table-cards w-full text-left text-sm font-nunito">
            <thead>
              <tr className="border-b border-warm-100 text-xs uppercase tracking-wide text-warm-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Adhérent</th>
                <th className="px-4 py-3 font-semibold">Mail Guardia</th>
                <th className="px-4 py-3 font-semibold">Équipe</th>
                <th className="px-4 py-3 font-semibold">Payé par</th>
                <th className="px-4 py-3 font-semibold text-right">Montant</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.members.map(m => (
                <tr key={m.id} className="border-b border-warm-50 last:border-none">
                  <td data-label="Adhésion" className="px-4 py-3 whitespace-nowrap text-warm-600">{frDate(m.joined_on)}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-warm-900 whitespace-nowrap">{m.last_name.toUpperCase()} {m.first_name}</span>
                    {m.tarif && <span className="block text-xs text-warm-500 whitespace-nowrap">{m.tarif}</span>}
                  </td>
                  <td data-label="Mail Guardia" className="px-4 py-3">
                    <SchoolEmailCell member={m} onSaved={() => { setMessage('Mail Guardia enregistré.'); load(); }} onError={setError} />
                  </td>
                  <td data-label="Équipe" className="px-4 py-3 whitespace-nowrap">
                    {m.team_id ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">{m.team_role || 'Membre'}</span>
                    ) : (
                      <button type="button" onClick={() => addToTeam(m)} className="text-xs font-semibold text-orange-700 hover:underline">
                        Ajouter à l'équipe
                      </button>
                    )}
                  </td>
                  <td data-label="Payé par" className="px-4 py-3 text-warm-700">{CHANNEL_LABELS[m.channel]}</td>
                  <td data-label="Montant" className="px-4 py-3 text-right tabular-nums">{formatEuros(m.amount)}</td>
                  <td className="cell-actions px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(m)} className="text-xs font-semibold text-orange-700 hover:underline mr-3">Modifier</button>
                    <button onClick={() => remove(m)} className="text-xs font-semibold text-red-600 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MemberDialog member={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setMessage(msg); load(); }} />
      )}
    </div>
  );
}
