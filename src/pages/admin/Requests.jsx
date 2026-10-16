import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { authClient } from '../../lib/auth-client';
import {
  btn, input, Empty, Notice, PageTitle, TableSkeleton, Modal, ROLE_LABELS, formatDateTime,
} from './ui';

export const REQUEST_TYPES = {
  'user.set_role':      'Changement de rôle',
  'user.delete_admin':  'Suppression d\'un compte administrateur',
  'email.add_admin':    'Nouvel administrateur',
  'email.set_role':     'Changement de rôle (liste d\'accès)',
  'email.delete_admin': 'Retrait d\'un administrateur',
  'entry.update':       'Correction d\'une opération',
  'entry.cancel':       'Annulation d\'une opération',
  'attachment.remove':  'Retrait d\'un justificatif',
};

const STATUS = {
  pending:   { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  approved:  { label: 'Validée',    cls: 'bg-green-100 text-green-800' },
  rejected:  { label: 'Refusée',    cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulée',    cls: 'bg-warm-100 text-warm-600' },
  expired:   { label: 'Expirée',    cls: 'bg-warm-100 text-warm-600' },
  obsolete:  { label: 'Caduque',    cls: 'bg-warm-100 text-warm-600' },
};

const FIELD_LABELS = {
  role: 'Rôle', email: 'Email', compte: 'Compte', acces: 'Accès',
  statut: 'Statut', date: 'Date', libelle: 'Libellé', montant: 'Montant', moyen: 'Moyen',
  ventilation: 'Ventilation', tiers: 'Tiers', notes: 'Notes', fichier: 'Fichier',
};

function formatValue(key, value) {
  if (value == null) return '—';
  if (key === 'role') return ROLE_LABELS[value] ?? value;
  return String(value);
}

/** Tableau avant / après, champ par champ. */
function Diff({ before, after }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return null;
  return (
    <table className="w-full text-sm font-nunito">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-warm-500">
          <th className="py-1.5 pr-4 font-semibold">Champ</th>
          <th className="py-1.5 pr-4 font-semibold">Avant</th>
          <th className="py-1.5 font-semibold">Après</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(k => {
          const b = formatValue(k, before?.[k]);
          const a = formatValue(k, after?.[k]);
          return (
            <tr key={k} className="border-t border-warm-100">
              <td className="py-1.5 pr-4 text-warm-600">{FIELD_LABELS[k] ?? k}</td>
              <td className={`py-1.5 pr-4 ${b !== a ? 'text-red-700 line-through decoration-red-300' : 'text-warm-800'}`}>{b}</td>
              <td className={`py-1.5 ${b !== a ? 'text-green-800 font-semibold' : 'text-warm-800'}`}>{a}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DecisionDialog({ request, mode, onDone, onClose }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === 'approve') await api.requests.approve(request.id, comment.trim() || undefined);
      else                    await api.requests.reject(request.id, comment.trim() || undefined);
      onDone(mode === 'approve' ? 'Demande validée et appliquée.' : 'Demande refusée.');
    } catch (err) {
      if (err.code === 'REAUTH_REQUIRED') setNeedsReauth(true);
      setError(err.message);
      setBusy(false);
    }
  };

  const reauth = () => authClient.signIn.social({
    provider: 'google', callbackURL: '/admin/demandes',
  });

  return (
    <Modal title={mode === 'approve' ? 'Valider la demande' : 'Refuser la demande'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="px-4 py-3 bg-warm-50 rounded-xl text-sm font-nunito text-warm-800 space-y-1">
          <p className="font-semibold">{REQUEST_TYPES[request.type] ?? request.type} — {request.target_label}</p>
          <p className="text-warm-600">Demandé par {request.requested_by_name} : {request.reason}</p>
        </div>
        <div>
          <label htmlFor="decision-comment" className="block text-sm font-semibold text-warm-700 mb-1.5">
            Commentaire (facultatif)
          </label>
          <textarea id="decision-comment" value={comment} onChange={e => setComment(e.target.value)}
            rows={2} maxLength={1000} className={input} />
        </div>
        {error && (
          <Notice tone="error">
            {error}
            {needsReauth && (
              <button type="button" onClick={reauth} className="block mt-2 font-semibold underline">
                Se reconnecter avec Google
              </button>
            )}
          </Notice>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={busy}
            className={mode === 'approve' ? btn.primary : 'px-5 py-2.5 bg-red-600 text-white font-nunito font-semibold text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60'}>
            {busy ? 'Traitement…' : mode === 'approve' ? 'Valider et appliquer' : 'Refuser'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequestCard({ request, currentUserId, onDecide, onCancel }) {
  const status = STATUS[request.status] ?? { label: request.status, cls: 'bg-warm-100 text-warm-600' };
  const mine = request.requested_by === currentUserId;
  const pending = request.status === 'pending';

  return (
    <article className="bg-white rounded-2xl border border-warm-100 p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">
            {REQUEST_TYPES[request.type] ?? request.type}
          </p>
          <h3 className="font-nunito font-semibold text-warm-900 mt-0.5">{request.target_label}</h3>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </header>

      <Diff before={request.before} after={request.after} />

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm font-nunito">
        <div>
          <dt className="text-warm-500">Motif</dt>
          <dd className="text-warm-800">{request.reason}</dd>
        </div>
        <div>
          <dt className="text-warm-500">Demandé par</dt>
          <dd className="text-warm-800">{request.requested_by_name ?? 'Compte supprimé'}, le {formatDateTime(request.requested_at)}</dd>
        </div>
        {pending && (
          <div>
            <dt className="text-warm-500">Expire le</dt>
            <dd className="text-warm-800">{formatDateTime(request.expires_at)}</dd>
          </div>
        )}
        {request.decided_at && request.decided_by_name && (
          <div>
            <dt className="text-warm-500">{request.status === 'approved' ? 'Validée par' : 'Traitée par'}</dt>
            <dd className="text-warm-800">
              {request.decided_by_name}, le {formatDateTime(request.decided_at)}
              {request.decision_comment ? ` — ${request.decision_comment}` : ''}
            </dd>
          </div>
        )}
      </dl>

      {pending && (
        <footer className="flex flex-wrap justify-end gap-2 pt-1">
          {mine ? (
            <>
              <span className="mr-auto self-center text-xs font-nunito text-warm-500">
                En attente de validation par un autre membre du bureau
              </span>
              <button onClick={() => onCancel(request)} className={btn.small}>Retirer ma demande</button>
            </>
          ) : (
            <>
              <button onClick={() => onDecide(request, 'reject')} className={btn.danger}>Refuser</button>
              <button onClick={() => onDecide(request, 'approve')} className={btn.small}>Valider</button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}

const VIEWS = [
  { id: 'todo',    label: 'À valider' },
  { id: 'mine',    label: 'Mes demandes' },
  { id: 'history', label: 'Toutes les demandes' },
];

export default function Requests({ currentUserId, onChange }) {
  const [view, setView] = useState('todo');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [deciding, setDeciding] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.requests.list(view === 'history' ? 'all' : 'pending')
      .then(d => setRequests(d.requests || []))
      .catch(err => { setRequests([]); setError(err.message); })
      .finally(() => setLoading(false));
  }, [view]);
  useEffect(load, [load]);

  const shown = requests.filter(r =>
    view === 'todo' ? r.requested_by !== currentUserId
    : view === 'mine' ? r.requested_by === currentUserId
    : true);

  const handleCancel = async (r) => {
    if (!confirm('Retirer cette demande ?')) return;
    try {
      await api.requests.cancel(r.id);
      setMessage('Demande retirée.');
      load(); onChange?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageTitle title="Demandes à valider"
        subtitle="Les actions sensibles ne sont appliquées qu'avec l'accord d'un second membre du bureau." />

      <div role="tablist" className="flex gap-1 mb-6 border-b border-warm-100">
        {VIEWS.map(v => (
          <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
            className={`px-4 py-2.5 -mb-px border-b-2 font-nunito text-sm font-semibold transition-colors ${
              view === v.id ? 'border-orange-500 text-orange-700' : 'border-transparent text-warm-500 hover:text-warm-800'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
        {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

        {loading ? <TableSkeleton cols={3} /> : shown.length === 0 ? (
          <Empty message={
            view === 'todo' ? 'Aucune demande en attente de votre validation.'
            : view === 'mine' ? 'Vous n\'avez aucune demande en attente.'
            : 'Aucune demande pour l\'instant.'} />
        ) : shown.map(r => (
          <RequestCard key={r.id} request={r} currentUserId={currentUserId}
            onDecide={(req, mode) => setDeciding({ req, mode })} onCancel={handleCancel} />
        ))}
      </div>

      {deciding && (
        <DecisionDialog request={deciding.req} mode={deciding.mode}
          onClose={() => setDeciding(null)}
          onDone={(msg) => { setDeciding(null); setMessage(msg); load(); onChange?.(); }} />
      )}
    </div>
  );
}
