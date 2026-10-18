import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { navigate, onLinkClick } from '../../../lib/router';
import { btn, input, Empty, Notice, PageTitle, TableSkeleton } from '../ui';
import { formatEuros, frDate } from './money';
import { useComptaMeta, categoryLabel, treasuryText, Amount, SummaryCard } from './shared';

export function ComptaSummary({ summary }) {
  if (!summary) return null;
  const t = summary.tresorerie;
  const ex = summary.exercice;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <SummaryCard label="Banque" value={formatEuros(t.banque)} tone={t.banque < 0 ? 'negative' : 'default'}
        hint={summary.derniere_operation_banque ? `Dernière opération le ${frDate(summary.derniere_operation_banque)}` : null} />
      <SummaryCard label="Caisse" value={formatEuros(t.caisse)} />
      {ex && (
        <SummaryCard label={`Résultat ${ex.fiscal_year.label.replace('Exercice ', '')}`} value={formatEuros(ex.resultat, { sign: true })}
          tone={ex.resultat < 0 ? 'negative' : 'positive'}
          hint={`${formatEuros(ex.produits)} de recettes, ${formatEuros(ex.charges)} de dépenses`} />
      )}
      <SummaryCard label="Sans justificatif" value={summary.sans_justificatif}
        tone={summary.sans_justificatif ? 'negative' : 'default'} hint="Dépenses sans ticket ni facture" />
      {(t.sumup !== 0 || t.helloasso !== 0 || summary.membres_a_rembourser !== 0) && (
        <>
          {t.sumup !== 0 && <SummaryCard label="SumUp en attente" value={formatEuros(t.sumup)} />}
          {t.helloasso !== 0 && <SummaryCard label="HelloAsso en attente" value={formatEuros(t.helloasso)} />}
          {summary.membres_a_rembourser !== 0 && (
            <SummaryCard label="À rembourser aux membres" value={formatEuros(summary.membres_a_rembourser)}
              tone="negative"
              hint={summary.remboursements.map(r => `${r.membre ?? 'Membre'} : ${formatEuros(r.montant)}`).join(', ')} />
          )}
        </>
      )}
    </div>
  );
}

export default function Operations() {
  const { meta } = useComptaMeta();
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', treasury: '', category: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = ['treasury', 'category', 'from', 'to'].filter(k => filters[k]).length;

  useEffect(() => {
    api.compta.summary().then(setSummary).catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const t = setTimeout(() => {
      api.compta.list(params).then(d => setOps(d.operations)).catch(err => setError(err.message));
    }, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [filters]);

  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const open = (id) => navigate(`/admin/compta/operations/${id}`);

  return (
    <div className="space-y-6">
      <PageTitle title="Comptabilité"
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/admin/compta/import" onClick={(e) => onLinkClick(e, '/admin/compta/import')} className={btn.secondary}>Importer un lot</a>
            <a href="/admin/compta/nouvelle" onClick={(e) => onLinkClick(e, '/admin/compta/nouvelle')} className={btn.primary}>Nouvelle opération</a>
          </div>
        } />

      {error && <Notice tone="error">{error}</Notice>}
      <ComptaSummary summary={summary} />

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
        <div className="flex gap-2 md:flex-1 md:min-w-[16rem]">
          <label className="sr-only" htmlFor="f-q">Rechercher</label>
          <input id="f-q" type="search" placeholder="Rechercher un libellé, un fournisseur…" value={filters.q}
            onChange={e => set({ q: e.target.value })} className={`${input} flex-1`} />
          <button type="button" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
            className={`md:hidden ${btn.secondary} px-3`}>
            Filtres{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
        <div className={`${showFilters ? 'flex' : 'hidden'} md:contents flex-col gap-3`}>
        <label className="sr-only" htmlFor="f-t">Moyen</label>
        <select id="f-t" value={filters.treasury} onChange={e => set({ treasury: e.target.value })} className={`${input} md:w-48`}>
          <option value="">Tous les moyens</option>
          <option value="banque">Banque</option>
          <option value="caisse">Caisse</option>
          <option value="sumup">SumUp</option>
          <option value="helloasso">HelloAsso</option>
          <option value="membre">Avance membre</option>
        </select>
        <label className="sr-only" htmlFor="f-c">Catégorie</label>
        <select id="f-c" value={filters.category} onChange={e => set({ category: e.target.value })} className={`${input} md:w-60`}>
          <option value="">Toutes les catégories</option>
          <optgroup label="Rentrées">
            {meta?.categories.filter(c => c.direction === 'recette').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </optgroup>
          <optgroup label="Sorties">
            {meta?.categories.filter(c => c.direction === 'depense').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value="remboursement_membre">Remboursement de membre</option>
          </optgroup>
        </select>
        <div className="flex gap-2 items-center">
          <label className="sr-only" htmlFor="f-from">Du</label>
          <input id="f-from" type="date" value={filters.from} onChange={e => set({ from: e.target.value })} className={`${input} md:w-40`} />
          <span className="text-warm-400 text-sm">au</span>
          <label className="sr-only" htmlFor="f-to">Au</label>
          <input id="f-to" type="date" value={filters.to} onChange={e => set({ to: e.target.value })} className={`${input} md:w-40`} />
        </div>
        </div>
      </div>

      {!ops || !meta ? <TableSkeleton cols={5} /> : ops.length === 0 ? (
        <Empty message="Aucune opération pour ces critères." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
          <table className="w-full text-left text-sm font-nunito">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-warm-100 text-xs uppercase tracking-wide text-warm-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Opération</th>
                <th className="px-4 py-3 font-semibold">Catégorie</th>
                <th className="px-4 py-3 font-semibold">Moyen</th>
                <th className="px-4 py-3 font-semibold text-right">Montant</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Justificatifs</span></th>
              </tr>
            </thead>
            <tbody>
              {ops.map(op => (
                <tr key={op.id} onClick={() => open(op.id)}
                  className="border-b border-warm-50 last:border-none hover:bg-orange-50/60 cursor-pointer align-top">
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-warm-600 hidden md:table-cell">{frDate(op.date)}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <a href={`/admin/compta/operations/${op.id}`} onClick={(e) => { e.stopPropagation(); onLinkClick(e, `/admin/compta/operations/${op.id}`); }}
                      className="font-semibold text-warm-900 hover:underline">{op.label}</a>
                    <p className="text-xs text-warm-500 mt-0.5">
                      <span className="md:hidden">{frDate(op.date)} · </span>
                      {op.number}{op.third_party ? ` · ${op.third_party}` : ''}
                      {op.pending ? ' · demande en attente' : ''}
                    </p>
                    <p className="text-xs text-warm-500 md:hidden">{op.categories.map(c => categoryLabel(meta, c)).join(', ')}</p>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-warm-700 hidden md:table-cell">
                    {op.categories.map(c => categoryLabel(meta, c)).join(', ') || '—'}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-warm-700 whitespace-nowrap hidden md:table-cell">{treasuryText(op)}</td>
                  <td className="px-3 sm:px-4 py-3 text-right"><Amount kind={op.kind} cents={op.total} /></td>
                  <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
                    {op.attachments > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warm-500" title={`${op.attachments} justificatif(s)`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {op.attachments}
                      </span>
                    ) : op.kind === 'depense' ? (
                      <span className="text-xs font-semibold text-red-700">Manquant</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
