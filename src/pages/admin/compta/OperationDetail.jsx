import { useCallback, useEffect, useState } from 'react';
import { api, uploadAttachment } from '../../../lib/api';
import { onLinkClick } from '../../../lib/router';
import { btn, Notice, PageTitle, TableSkeleton, RequestDialog, formatDateTime } from '../ui';
import { formatEuros, frDate, KIND_LABELS } from './money';
import { useComptaMeta, categoryLabel, treasuryText, EntryStatus, FilePicker, prepareFile, Amount } from './shared';
import OperationForm from './OperationForm';

const SOURCES = { manuel: 'Saisie manuelle', import: 'Import', banque: 'Relevé bancaire', sumup: 'SumUp', helloasso: 'HelloAsso' };

function Attachments({ op, onChanged, onRemove }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = async () => {
    setBusy(true); setError(null);
    const errors = [];
    for (const file of files) {
      try {
        const { blob, name } = await prepareFile(file);
        await uploadAttachment(op.id, blob, name);
      } catch (err) {
        errors.push(err.message);
      }
    }
    setFiles([]);
    setBusy(false);
    if (errors.length) setError(errors.join(' — '));
    onChanged();
  };

  return (
    <section className="bg-white rounded-2xl border border-warm-100 p-5">
      <h2 className="font-nunito font-semibold text-warm-900 mb-3">Justificatifs</h2>
      {op.attachments.length === 0 ? (
        <p className="font-nunito text-sm text-warm-500 mb-4">
          {op.kind === 'depense' ? 'Aucun justificatif : ajoutez le ticket ou la facture.' : 'Aucun justificatif.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {op.attachments.map(a => (
            <li key={a.id} className="border border-warm-100 rounded-xl overflow-hidden flex flex-col">
              <a href={api.compta.attachmentUrl(a.id)} target="_blank" rel="noopener noreferrer"
                className="block bg-warm-50 aspect-[3/4] overflow-hidden">
                {a.mime.startsWith('image/') ? (
                  <img src={api.compta.attachmentUrl(a.id)} alt={a.filename} loading="lazy" className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="w-full h-full flex flex-col items-center justify-center gap-2 text-warm-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-semibold">PDF</span>
                  </span>
                )}
              </a>
              <div className="p-2 text-xs font-nunito">
                <p className="truncate text-warm-800" title={a.filename}>{a.filename}</p>
                <p className="text-warm-400">{Math.round(a.size / 1024)} Ko</p>
                <div className="flex gap-3 mt-1">
                  <a href={api.compta.attachmentUrl(a.id, true)} className="font-semibold text-orange-700 hover:underline">Télécharger</a>
                  <button type="button" onClick={() => onRemove(a)} className="font-semibold text-red-600 hover:underline">Retirer</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FilePicker files={files} onChange={setFiles} disabled={busy} />
      {files.length > 0 && (
        <button type="button" onClick={upload} disabled={busy} className={`${btn.primary} mt-3`}>
          {busy ? 'Envoi…' : `Joindre ${files.length} fichier${files.length > 1 ? 's' : ''}`}
        </button>
      )}
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
    </section>
  );
}

export default function OperationDetail({ id, currentUserId }) {
  const { meta } = useComptaMeta();
  const [op, setOp] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('demande')) return 'Demande de correction envoyée. Elle sera appliquée après validation par un autre membre du bureau.';
    if (q.get('corrigee')) return 'Correction enregistrée.';
    if (q.get('justificatifs') === 'echec') return null;
    return null;
  });
  const [editing, setEditing] = useState(null);   // 'correct' | 'request'
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    api.compta.get(id).then(setOp).catch(err => setError(err.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!op || !meta) return <TableSkeleton cols={3} />;

  const isOperation = op.kind !== 'contrepassation';
  const active = op.status === 'active' && isOperation;
  const deadline = op.self_editable_until ? new Date(op.self_editable_until).getTime() : 0;
  const canSelfEdit = active && op.created_by === currentUserId && deadline > now;
  const minutesLeft = Math.max(0, Math.ceil((deadline - now) / 60_000));

  if (editing) {
    return (
      <div>
        <PageTitle title={editing === 'correct' ? `Corriger ${op.number}` : `Demander une correction de ${op.number}`}
          subtitle={editing === 'request'
            ? 'La correction sera appliquée après validation par un autre membre du bureau, par une écriture inverse suivie de la nouvelle version.'
            : `Correction directe possible encore ${minutesLeft} min.`} />
        <OperationForm mode={editing} initial={op.operation} operationId={op.id} onCancel={() => setEditing(null)} />
      </div>
    );
  }

  const o = op.operation;
  const banner = new URLSearchParams(window.location.search).get('justificatifs') === 'echec'
    ? 'L\'opération est enregistrée, mais certains justificatifs n\'ont pas pu être envoyés : ajoutez-les ci-dessous.'
    : null;

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/compta" onClick={(e) => onLinkClick(e, '/admin/compta')}
          className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour aux opérations</a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">
            {KIND_LABELS[op.kind]} · {op.number}
          </p>
          <h1 className="font-playfair text-2xl md:text-3xl font-semibold text-warm-900 mt-1">{op.label}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Amount kind={op.kind} cents={op.total} className="text-xl" />
            <EntryStatus status={op.status} />
          </div>
        </div>
        {active && !op.pending_request && (
          <div className="flex flex-wrap gap-2">
            {canSelfEdit ? (
              <button onClick={() => setEditing('correct')} className={btn.small}>Corriger (encore {minutesLeft} min)</button>
            ) : (
              <button onClick={() => setEditing('request')} className={btn.small}>Demander une correction</button>
            )}
            <button onClick={() => setDialog({
              title: 'Demander l\'annulation',
              summary: `${op.number} — ${op.label} (${formatEuros(op.total)}). Une écriture inverse sera passée ; rien n'est effacé.`,
              request: { type: 'entry.cancel', target_id: op.id, payload: {} },
            })} className={btn.danger}>Demander l'annulation</button>
          </div>
        )}
      </div>

      {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
      {banner && <Notice tone="error">{banner}</Notice>}
      {op.pending_request && (
        <Notice>
          Une demande est en attente sur cette opération ({op.pending_request.requested_by_name}).{' '}
          <a href="/admin/demandes" onClick={(e) => onLinkClick(e, '/admin/demandes')} className="font-semibold underline">Voir les demandes</a>
        </Notice>
      )}
      {op.status === 'replaced' && op.replaced_by_id && (
        <Notice>
          Cette opération a été corrigée.{' '}
          <a href={`/admin/compta/operations/${op.replaced_by_id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${op.replaced_by_id}`)}
            className="font-semibold underline">Voir la version en vigueur</a>
        </Notice>
      )}

      <section className="bg-white rounded-2xl border border-warm-100 p-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm font-nunito">
          <div><dt className="text-warm-500">Date</dt><dd className="text-warm-900">{frDate(op.date)}</dd></div>
          {o && <div><dt className="text-warm-500">Moyen</dt><dd className="text-warm-900">{treasuryText(o)}</dd></div>}
          {o?.third_party && <div><dt className="text-warm-500">{o.treasury === 'membre' ? 'Membre à rembourser' : 'Tiers'}</dt><dd className="text-warm-900">{o.third_party}</dd></div>}
          <div><dt className="text-warm-500">Saisie</dt><dd className="text-warm-900">{op.created_by_name ?? '—'}, le {formatDateTime(op.created_at)}</dd></div>
          <div><dt className="text-warm-500">Origine</dt><dd className="text-warm-900">{SOURCES[op.source] ?? op.source}</dd></div>
          {o?.notes && <div className="sm:col-span-2"><dt className="text-warm-500">Notes</dt><dd className="text-warm-900 whitespace-pre-line">{o.notes}</dd></div>}
        </dl>

        {o?.lines && (
          <table className="w-full text-sm font-nunito mt-5">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-warm-500 border-b border-warm-100">
                <th className="py-2 font-semibold">Catégorie</th>
                <th className="py-2 font-semibold">Détail</th>
                <th className="py-2 font-semibold text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l, i) => (
                <tr key={i} className="border-b border-warm-50 last:border-none">
                  <td className="py-2 text-warm-900">{categoryLabel(meta, l.category)}</td>
                  <td className="py-2 text-warm-600">{l.label ?? ''}</td>
                  <td className="py-2 text-right tabular-nums text-warm-900">{formatEuros(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer font-nunito text-sm font-semibold text-warm-600">Écritures comptables</summary>
          <table className="w-full text-sm font-nunito mt-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-warm-500 border-b border-warm-100">
                <th className="py-2 font-semibold">Compte</th>
                <th className="py-2 font-semibold text-right">Débit</th>
                <th className="py-2 font-semibold text-right">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {op.lines.map((l, i) => (
                <tr key={i} className="border-b border-warm-50 last:border-none">
                  <td className="py-2 text-warm-800">{l.account_code} — {l.account_label}</td>
                  <td className="py-2 text-right tabular-nums">{l.debit ? formatEuros(l.debit) : ''}</td>
                  <td className="py-2 text-right tabular-nums">{l.credit ? formatEuros(l.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {isOperation && (
        <Attachments op={op} onChanged={load} onRemove={(a) => setDialog({
          title: 'Retirer un justificatif',
          summary: `${a.filename} — le fichier reste conservé dans l'historique.`,
          request: { type: 'attachment.remove', target_id: a.id, payload: {} },
        })} />
      )}

      {op.history.length > 1 && (
        <section className="bg-white rounded-2xl border border-warm-100 p-5">
          <h2 className="font-nunito font-semibold text-warm-900 mb-3">Historique de l'opération</h2>
          <ol className="space-y-2 text-sm font-nunito">
            {op.history.map(h => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <a href={`/admin/compta/operations/${h.id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${h.id}`)}
                  className={`font-semibold ${h.id === op.id ? 'text-warm-900' : 'text-orange-700 hover:underline'}`}>{h.number}</a>
                <span className="text-warm-600">{KIND_LABELS[h.kind]}</span>
                <EntryStatus status={h.status} />
                <span className="text-warm-500">{h.created_by_name}, le {formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {dialog && (
        <RequestDialog title={dialog.title} summary={dialog.summary} onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            await api.requests.create({ ...dialog.request, reason });
            setDialog(null);
            setMessage('Demande envoyée. Elle sera appliquée après validation par un autre membre du bureau.');
            load();
          }} />
      )}
    </div>
  );
}
