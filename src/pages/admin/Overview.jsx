import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { onLinkClick } from '../../lib/router';
import { PageTitle, Notice, formatDateTime } from './ui';
import { ACTION_LABELS, describeEntry } from './Audit';
import { ComptaSummary } from './compta/Operations';

function Stat({ label, value, href, hint }) {
  return (
    <a href={href} onClick={(e) => onLinkClick(e, href)}
      className="block bg-white rounded-2xl border border-warm-100 p-5 hover:border-orange-300 transition-colors">
      <p className="font-nunito text-sm text-warm-500">{label}</p>
      <p className="font-playfair text-3xl font-semibold text-warm-900 mt-1">{value ?? '—'}</p>
      {hint && <p className="font-nunito text-xs text-warm-500 mt-2">{hint}</p>}
    </a>
  );
}

export default function Overview({ summary }) {
  const [activity, setActivity] = useState(null);
  const [compta, setCompta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.compta.summary().then(setCompta).catch(err => setError(err.message));
    api.audit.list({ limit: 8 })
      .then(d => setActivity(d.entries || []))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div>
      <PageTitle title="Tableau de bord" />

      {compta && (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-nunito font-semibold text-warm-900">Trésorerie</h2>
            <a href="/admin/compta" onClick={(e) => onLinkClick(e, '/admin/compta')}
              className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Comptabilité</a>
          </div>
          <ComptaSummary summary={compta} />
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <Stat label="Demandes à valider" value={summary?.to_review} href="/admin/demandes"
          hint={summary?.to_review ? 'Des actions attendent votre accord' : 'Rien en attente'} />
        <Stat label="Mes demandes en attente" value={summary?.mine} href="/admin/demandes" />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-nunito font-semibold text-warm-900">Activité récente</h2>
          <a href="/admin/historique" onClick={(e) => onLinkClick(e, '/admin/historique')}
            className="font-nunito text-sm font-semibold text-orange-700 hover:underline">
            Tout l'historique
          </a>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {activity && (
          activity.length === 0 ? (
            <p className="font-nunito text-sm text-warm-500">Aucune action enregistrée pour l'instant.</p>
          ) : (
            <ul className="bg-white rounded-2xl border border-warm-100 divide-y divide-warm-50">
              {activity.map(e => (
                <li key={e.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-nunito text-sm">
                  <span className="text-warm-500 whitespace-nowrap sm:w-36">{formatDateTime(e.created_at)}</span>
                  <span className="text-warm-800 font-semibold sm:w-40">{e.actor_name ?? e.actor_email ?? 'Système'}</span>
                  <span className="text-warm-700 flex-1">
                    {ACTION_LABELS[e.action] ?? e.action}
                    {describeEntry(e) && <span className="text-warm-500"> — {describeEntry(e)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}
