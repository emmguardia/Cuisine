import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { btn, Notice, PageTitle, TableSkeleton, formatDateTime } from './ui';
import { frDate } from './compta/money';

const DESCRIPTIONS = {
  sumup: 'Ventes au terminal (une opération par journée terminée), commissions retenues sur les versements, remboursements clients. Le virement du compte SumUp vers le Crédit Mutuel reste à saisir : Virement interne, de SumUp vers Banque.',
  helloasso: 'Adhésions, dons et ventes en ligne, fiches adhérents, et versements de HelloAsso vers le Crédit Mutuel (pas besoin du relevé pour ces rentrées).',
};

function cursorText(provider, c) {
  if (!c) return null;
  if (provider === 'sumup') return `Ventes prises en compte jusqu'au ${frDate(c.sales_after_day)}, commissions jusqu'au ${frDate(c.payouts_after_day)}.`;
  return `Paiements pris en compte jusqu'au ${formatDateTime(c.payments_after)}, versements jusqu'au ${frDate(c.cashouts_after_day)}.`;
}

export default function Integrations() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.integrations.status().then(d => setItems(d.integrations)).catch(err => setError(err.message));
  }, []);

  const sync = async (provider) => {
    setBusy(provider); setError(null); setMessage(null);
    try {
      const { result, integrations } = await api.integrations.sync(provider);
      setItems(integrations);
      if (result.error) setError(result.error);
      else if (result.skipped) setMessage('Une synchronisation est déjà en cours.');
      else setMessage(result.created?.length
        ? `${result.created.length} opération(s) créée(s) : ${result.created.join(', ')}.`
        : 'Rien de nouveau.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Intégrations"
        subtitle="Synchronisation automatique toutes les 15 minutes. Chaque paiement n'est compté qu'une fois." />
      {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

      {!items ? <TableSkeleton cols={3} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(it => (
            <section key={it.provider} className="bg-white rounded-2xl border border-warm-100 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-nunito text-lg font-bold text-warm-900">{it.label}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  !it.configured ? 'bg-warm-100 text-warm-600'
                  : it.last_error && (!it.last_success_at || new Date(it.last_error_at) > new Date(it.last_success_at)) ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-800'}`}>
                  {!it.configured ? 'Non configuré' : it.running ? 'En cours' :
                    it.last_error && (!it.last_success_at || new Date(it.last_error_at) > new Date(it.last_success_at)) ? 'En erreur' : 'Actif'}
                </span>
              </div>
              <p className="font-nunito text-sm text-warm-600">{DESCRIPTIONS[it.provider]}</p>
              <dl className="font-nunito text-sm grid grid-cols-1 gap-1">
                <div><dt className="inline text-warm-500">Dernière réussite : </dt><dd className="inline text-warm-900">{it.last_success_at ? formatDateTime(it.last_success_at) : 'jamais'}</dd></div>
                {it.last_error && (
                  <div><dt className="inline text-warm-500">Dernière erreur : </dt>
                    <dd className="inline text-red-700">{it.last_error} ({formatDateTime(it.last_error_at)})</dd></div>
                )}
                {it.last_created?.length > 0 && (
                  <div><dt className="inline text-warm-500">Dernières opérations créées : </dt><dd className="inline text-warm-900">{it.last_created.join(', ')}</dd></div>
                )}
                <div className="text-xs text-warm-500 mt-1">{cursorText(it.provider, it.cursor)}</div>
              </dl>
              <div className="mt-auto pt-2">
                <button onClick={() => sync(it.provider)} disabled={!it.configured || busy} className={btn.secondary}>
                  {busy === it.provider ? 'Synchronisation…' : 'Synchroniser maintenant'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
