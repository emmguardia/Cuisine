import { useEffect, useRef, useState } from 'react';

/* ─── Composants communs de l'espace admin ───────────────────────────── */

export const btn = {
  primary:   'whitespace-nowrap px-5 py-2.5 bg-orange-500 text-white font-nunito font-semibold text-sm rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60',
  secondary: 'whitespace-nowrap px-5 py-2.5 border border-warm-200 text-warm-700 font-nunito font-semibold text-sm rounded-xl hover:bg-warm-50 transition-colors disabled:opacity-60',
  small:     'px-3 py-1.5 text-xs font-semibold text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-60',
  danger:    'px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60',
};

export const input =
  'w-full px-4 py-2.5 border border-warm-200 rounded-xl bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 font-nunito text-sm text-warm-800';

export const ROLE_LABELS = { admin: 'Administrateur', membre: 'Membre' };

export function RoleBadge({ role }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-warm-100 text-warm-600'
    }`}>{ROLE_LABELS[role] ?? role}</span>
  );
}

export function TableSkeleton({ cols }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-100 p-6 animate-pulse space-y-4" aria-hidden="true">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4">
          {[...Array(cols)].map((_, j) => (
            <div key={j} className="h-4 bg-warm-50 rounded-full flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Empty({ message }) {
  return (
    <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-warm-200">
      <p className="font-nunito text-sm text-warm-500">{message}</p>
    </div>
  );
}

/** Bandeau d'information ou d'erreur. */
export function Notice({ tone = 'info', children, onClose }) {
  const tones = {
    info:    'bg-orange-50 border-orange-200 text-warm-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error:   'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 px-4 py-3 border rounded-xl text-sm font-nunito ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-xs font-semibold opacity-70 hover:opacity-100" aria-label="Fermer">
          Fermer
        </button>
      )}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-playfair text-2xl md:text-3xl font-semibold text-warm-900">{title}</h1>
        {subtitle && <p className="font-nunito text-sm text-warm-500 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── Fenêtre modale accessible ──────────────────────────────────────── */
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('textarea, input, select, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-warm-900/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
        <h2 id="modal-title" className="font-playfair text-xl font-semibold text-warm-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * Demande à double validation : récapitule le changement, exige un motif,
 * puis appelle onSubmit(reason). Rien n'est appliqué tant qu'un autre membre
 * du bureau n'a pas validé.
 */
export function RequestDialog({ title, summary, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) { setError('Indiquez un motif (5 caractères minimum).'); return; }
    setSending(true); setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="px-4 py-3 bg-warm-50 rounded-xl text-sm font-nunito text-warm-800">{summary}</div>
        <p className="text-sm font-nunito text-warm-600">
          Cette action sera appliquée après validation par un autre membre du bureau.
        </p>
        <div>
          <label htmlFor="request-reason" className="block text-sm font-semibold text-warm-700 mb-1.5">Motif</label>
          <textarea id="request-reason" value={reason} onChange={e => setReason(e.target.value)}
            rows={3} maxLength={1000} className={input} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btn.secondary}>Annuler</button>
          <button type="submit" disabled={sending} className={btn.primary}>
            {sending ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
