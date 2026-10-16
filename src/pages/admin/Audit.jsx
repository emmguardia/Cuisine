import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Empty, Notice, PageTitle, TableSkeleton, btn, formatDateTime } from './ui';
import { REQUEST_TYPES } from './Requests';

export const ACTION_LABELS = {
  'change_request.create':   'Demande créée',
  'change_request.approve':  'Demande validée',
  'change_request.reject':   'Demande refusée',
  'change_request.cancel':   'Demande retirée',
  'change_request.obsolete': 'Demande devenue caduque',
  'user.delete':             'Compte supprimé',
  'allowed_email.add':       'Email autorisé',
  'allowed_email.delete':    'Email retiré',
  'team.create':             'Membre d\'équipe ajouté',
  'team.update':             'Membre d\'équipe modifié',
  'team.delete':             'Membre d\'équipe supprimé',
  'entry.create':            'Opération saisie',
  'entry.self_correct':      'Opération corrigée par son auteur',
  'entry.replace':           'Opération corrigée (double validation)',
  'entry.cancel':            'Opération annulée (double validation)',
  'attachment.add':          'Justificatif ajouté',
  'compta.import':           'Lot importé',
  'member.create':           'Adhérent ajouté',
  'member.update':           'Adhérent modifié',
  'member.delete':           'Adhérent supprimé',
  'event.create':            'Événement créé',
  'event.update':            'Événement modifié',
  'event.delete':            'Événement supprimé',
  'event.link':              'Opération rattachée à un événement',
  'event.unlink':            'Opération détachée d\'un événement',
  'integration.sync':        'Synchronisation automatique',
  'compta.import_cli':       'Import lancé en ligne de commande',
};

/** Résumé lisible d'une ligne d'audit. */
export function describeEntry(e) {
  const d = e.details ?? {};
  if (d.type && REQUEST_TYPES[d.type]) return REQUEST_TYPES[d.type] + (d.reason ? ` — ${d.reason}` : '');
  if (d.name && d.number) return `${d.name} — ${d.number} ${d.label ?? ''}`.trim();
  if (d.number && d.label) return `${d.number} — ${d.label}`;
  if (d.number) return d.number;
  if (d.filename) return d.filename;
  if (d.created != null && d.trigger) return `${d.created} opération(s) créée(s)${d.numbers?.length ? ` : ${d.numbers.slice(0, 6).join(', ')}` : ''}`;
  if (d.note) return d.note;
  if (d.imported != null) return `${d.imported} opération(s), ${d.members ?? 0} adhérent(s), ${d.events ?? 0} événement(s)`;
  if (d.email) return d.email;
  if (d.name)  return d.name;
  if (d.comment) return d.comment;
  return '';
}

const PAGE = 50;

export default function Audit() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = async (before) => {
    const params = { limit: PAGE, ...(before ? { before } : {}) };
    const d = await api.audit.list(params);
    setMore((d.entries || []).length === PAGE);
    return d.entries || [];
  };

  useEffect(() => {
    fetchPage()
      .then(setEntries)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    try {
      const next = await fetchPage(entries[entries.length - 1]?.id);
      setEntries(es => [...es, ...next]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageTitle title="Historique"
        subtitle="Toutes les actions du bureau, horodatées. Ce journal ne peut être ni modifié ni effacé." />

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      {loading ? <TableSkeleton cols={4} /> : entries.length === 0 ? (
        <Empty message="Aucune action enregistrée pour l'instant." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
          <table className="w-full text-left text-sm font-nunito">
            <thead>
              <tr className="border-b border-warm-100 text-xs uppercase tracking-wide text-warm-500">
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                <th className="px-4 py-3 font-semibold">Auteur</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Détail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-warm-50 last:border-none align-top">
                  <td className="px-4 py-3 text-warm-600 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                  <td className="px-4 py-3 text-warm-800">{e.actor_name ?? e.actor_email ?? 'Système'}</td>
                  <td className="px-4 py-3 text-warm-800 whitespace-nowrap">{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="px-4 py-3 text-warm-600">{describeEntry(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {more && (
        <div className="mt-4 flex justify-center">
          <button onClick={loadMore} className={btn.secondary}>Afficher plus</button>
        </div>
      )}
    </div>
  );
}
