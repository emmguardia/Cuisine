import { useState } from 'react';
import { api } from '../../../lib/api';
import { authClient } from '../../../lib/auth-client';
import { onLinkClick } from '../../../lib/router';
import { btn, Notice, PageTitle } from '../ui';
import { formatEuros, frDate, KIND_LABELS } from './money';

const STATUS = {
  a_importer:    { label: 'À importer',     cls: 'text-orange-700' },
  deja_importee: { label: 'Déjà importée',  cls: 'text-warm-500' },
  importee:      { label: 'Importée',       cls: 'text-green-800' },
};

/**
 * Import d'un lot (fichier .json « quisine-lot ») : reprise de l'historique
 * bancaire et des justificatifs. Aperçu d'abord, rien n'est écrit avant
 * confirmation. Réimporter le même fichier n'ajoute rien.
 */
export default function Import() {
  const [lot, setLot] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reauth, setReauth] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (err) => {
    setReauth(err.code === 'REAUTH_REQUIRED');
    setError(err.details?.length ? `${err.message} : ${err.details.slice(0, 3).map(d => `${d.champ} ${d.message}`).join(' ; ')}` : err.message);
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null); setPreview(null); setResult(null); setReauth(false);
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error('Fichier trop lourd (40 Mo maximum)');
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== 'quisine-lot') throw new Error('Ce fichier n\'est pas un lot d\'import Club Quisine');
      setLot(parsed);
      setFileName(file.name);
      setBusy(true);
      setPreview(await api.compta.importLot(parsed, true));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true); setError(null);
    try {
      setResult(await api.compta.importLot(lot, false));
      setPreview(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const rows = result?.operations ?? preview?.operations ?? [];
  const extras = result ?? preview;
  const todo = [
    ...(preview?.operations ?? []), ...(preview?.members ?? []), ...(preview?.events ?? []),
  ].filter(o => o.status === 'a_importer');

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/compta" onClick={(e) => onLinkClick(e, '/admin/compta')}
          className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour aux opérations</a>
      </div>
      <PageTitle title="Importer un lot"
        subtitle="Reprise d'opérations et de justificatifs préparés à l'avance. Aperçu avant tout enregistrement ; un même lot ne s'importe qu'une fois." />

      <div className="bg-white rounded-2xl border border-warm-100 p-5">
        <label className="inline-block">
          <span className={`${btn.primary} inline-block cursor-pointer`}>{busy ? 'Lecture…' : 'Choisir le fichier du lot'}</span>
          <input type="file" accept="application/json,.json" onChange={pick} disabled={busy} className="sr-only" />
        </label>
        {fileName && <p className="mt-3 font-nunito text-sm text-warm-600">{fileName}{lot?.label ? ` — ${lot.label}` : ''}</p>}
      </div>

      {error && (
        <Notice tone="error">
          {error}
          {reauth && (
            <button type="button" className="block mt-2 font-semibold underline"
              onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/admin/compta/import' })}>
              Se reconnecter avec Google
            </button>
          )}
        </Notice>
      )}

      {result && (
        <Notice tone="success">
          {result.operations.filter(o => o.status === 'importee').length} opération(s),{' '}
          {(result.members ?? []).filter(o => o.status === 'importee').length} adhérent(s) et{' '}
          {(result.events ?? []).filter(o => o.status === 'importee').length} événement(s) importés ;{' '}
          {[...result.operations, ...(result.members ?? []), ...(result.events ?? [])].filter(o => o.status === 'deja_importee').length} élément(s) déjà présent(s).
        </Notice>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
          <table className="w-full text-left text-sm font-nunito">
            <thead>
              <tr className="border-b border-warm-100 text-xs uppercase tracking-wide text-warm-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Opération</th>
                <th className="px-4 py-3 font-semibold text-right">Montant</th>
                <th className="px-4 py-3 font-semibold text-center">Justif.</th>
                <th className="px-4 py-3 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ref} className="border-b border-warm-50 last:border-none">
                  <td className="px-4 py-2.5 whitespace-nowrap text-warm-600">{frDate(r.date)}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-warm-900">{r.label}</span>
                    <span className="block text-xs text-warm-500">{KIND_LABELS[r.kind]}{r.number ? ` · ${r.number}` : ''}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.kind === 'depense' ? '-' : r.kind === 'recette' ? '+' : ''}{formatEuros(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">{r.attachments || ''}</td>
                  <td className={`px-4 py-2.5 font-semibold ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {extras && (extras.members?.length > 0 || extras.events?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {extras.members?.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-100 p-4">
              <h2 className="font-nunito font-semibold text-warm-900 mb-2">Adhérents ({extras.members.length})</h2>
              <ul className="text-sm font-nunito space-y-1 max-h-60 overflow-y-auto">
                {extras.members.map(m => (
                  <li key={m.ref} className="flex justify-between gap-3">
                    <span className="text-warm-800">{m.name}</span>
                    <span className={`font-semibold ${STATUS[m.status]?.cls}`}>{STATUS[m.status]?.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {extras.events?.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-100 p-4">
              <h2 className="font-nunito font-semibold text-warm-900 mb-2">Événements ({extras.events.length})</h2>
              <ul className="text-sm font-nunito space-y-1">
                {extras.events.map(e => (
                  <li key={e.ref} className="flex justify-between gap-3">
                    <span className="text-warm-800">{frDate(e.date)} · {e.name} ({e.operations} opérations)</span>
                    <span className={`font-semibold ${STATUS[e.status]?.cls}`}>{STATUS[e.status]?.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={run} disabled={busy || todo.length === 0} className={btn.primary}>
            {busy ? 'Import…' : todo.length ? `Importer ${todo.length} élément${todo.length > 1 ? 's' : ''}` : 'Rien de nouveau à importer'}
          </button>
          <p className="font-nunito text-sm text-warm-500">Une connexion de moins de 10 minutes est demandée pour l'import.</p>
        </div>
      )}
    </div>
  );
}
