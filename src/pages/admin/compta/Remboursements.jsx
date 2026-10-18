import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { onLinkClick } from '../../../lib/router';
import { btn, Empty, Notice, PageTitle, TableSkeleton } from '../ui';
import { formatEuros, frDate } from './money';

const ASSO = {
  nom: 'Club Quisine',
  statut: 'Association loi 1901',
  adresse: ['Guardia Cybersecurity School', '50 rue de Marseille', '69007 Lyon'],
};

const noteUrl = (membre) => `/admin/compta/note-de-frais?membre=${encodeURIComponent(membre)}`;
const refundUrl = (m) => `/admin/compta/nouvelle?remboursement=${encodeURIComponent(m.membre)}&montant=${m.du}`;

/* ─── Liste : qui attend combien ─────────────────────────────────────── */
export function Remboursements() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.compta.remboursements().then(d => setData(d.membres)).catch(err => setError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <a href="/admin/compta" onClick={(e) => onLinkClick(e, '/admin/compta')}
        className="font-nunito text-sm font-semibold text-orange-700 hover:underline">Retour aux opérations</a>
      <PageTitle title="Remboursements"
        subtitle="Dépenses avancées par des membres. Pour rembourser : imprimer la note de frais, la faire signer, faire le virement, puis joindre la note signée au virement." />
      {error && <Notice tone="error">{error}</Notice>}

      {!data ? <TableSkeleton cols={3} /> : data.length === 0 ? (
        <Empty message="Aucune dépense avancée par un membre." />
      ) : data.map(m => (
        <section key={m.membre} className="bg-white rounded-2xl border border-warm-100 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-nunito text-lg font-bold text-warm-900">{m.membre}</h2>
              <p className="font-nunito text-sm text-warm-600">
                {formatEuros(m.avance)} avancés{m.rembourse ? `, ${formatEuros(m.rembourse)} déjà remboursés` : ''}
              </p>
            </div>
            <p className={`font-nunito text-xl font-bold tabular-nums ${m.du > 0 ? 'text-red-700' : 'text-green-800'}`}>
              {m.du > 0 ? `${formatEuros(m.du)} à rembourser` : 'Soldé'}
            </p>
          </div>

          <ul className="divide-y divide-warm-50 font-nunito text-sm">
            {m.avances.map(a => (
              <li key={a.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-warm-500 w-20">{frDate(a.date)}</span>
                <a href={`/admin/compta/operations/${a.id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${a.id}`)}
                  className="flex-1 min-w-[10rem] text-warm-900 hover:underline">{a.label} <span className="text-xs text-warm-500">{a.number}</span></a>
                <span className={`text-xs ${a.attachments ? 'text-warm-500' : 'text-red-700 font-semibold'}`}>
                  {a.attachments ? `${a.attachments} justificatif${a.attachments > 1 ? 's' : ''}` : 'Ticket manquant'}
                </span>
                <span className="tabular-nums font-semibold w-20 text-right">{formatEuros(a.amount)}</span>
              </li>
            ))}
            {m.remboursements.map(r => (
              <li key={r.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-green-800">
                <span className="w-20">{frDate(r.date)}</span>
                <a href={`/admin/compta/operations/${r.id}`} onClick={(e) => onLinkClick(e, `/admin/compta/operations/${r.id}`)}
                  className="flex-1 min-w-[10rem] hover:underline">{r.label} <span className="text-xs">{r.number}</span></a>
                <span className="tabular-nums font-semibold w-20 text-right">-{formatEuros(r.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <a href={noteUrl(m.membre)} onClick={(e) => onLinkClick(e, noteUrl(m.membre))} className={btn.secondary}>Note de frais</a>
            {m.du > 0 && (
              <a href={refundUrl(m)} onClick={(e) => onLinkClick(e, refundUrl(m))} className={btn.primary}>
                Rembourser {formatEuros(m.du)}
              </a>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Document : note de frais pré-remplie, à imprimer ou enregistrer en PDF ── */
function Box({ checked }) {
  return <span className={`inline-block w-3.5 h-3.5 border border-warm-800 mr-1.5 align-[-2px] ${checked ? 'bg-warm-800' : ''}`} aria-hidden="true" />;
}

export function NoteDeFrais() {
  const membre = new URLSearchParams(window.location.search).get('membre') ?? '';
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.compta.remboursements(membre)
      .then(d => d.membres[0] ? setM(d.membres[0]) : setError('Aucune dépense avancée pour ce membre.'))
      .catch(err => setError(err.message));
  }, [membre]);

  const today = new Date().toLocaleDateString('fr-FR');
  const back = '/admin/compta/remboursements';

  return (
    <div className="min-h-screen bg-warm-50 print:bg-white py-6 print:py-0">
      <div className="no-print max-w-[210mm] mx-auto px-4 mb-4 flex flex-wrap items-center gap-3 font-nunito">
        <a href={back} onClick={(e) => onLinkClick(e, back)} className="text-sm font-semibold text-orange-700 hover:underline">Retour</a>
        <button type="button" onClick={() => window.print()} className={btn.primary}>Imprimer ou enregistrer en PDF</button>
        <span className="text-xs text-warm-500">Sur téléphone : Partager, puis Imprimer, puis Enregistrer en PDF.</span>
      </div>

      {error && <div className="max-w-[210mm] mx-auto px-4"><Notice tone="error">{error}</Notice></div>}
      {m && (
        <article className="note-de-frais max-w-[210mm] mx-auto bg-white shadow-sm print:shadow-none px-[14mm] py-[12mm] font-nunito text-[13px] text-warm-900 leading-relaxed">
          <header className="flex justify-between gap-6 mb-8">
            <div>
              <p className="font-playfair text-xl font-semibold">{ASSO.nom}</p>
              <p className="text-warm-700">{ASSO.statut}</p>
              {ASSO.adresse.map(l => <p key={l} className="text-warm-700">{l}</p>)}
            </div>
            <div className="text-right">
              <h1 className="font-playfair text-2xl font-semibold">Note de frais</h1>
              <p className="text-warm-700">Demande de remboursement</p>
              <p className="text-warm-700">Établie le {today}</p>
            </div>
          </header>

          <section className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1">
            <p><span className="text-warm-600">Bénéficiaire : </span><strong>{m.membre}</strong></p>
            <p><span className="text-warm-600">Qualité : </span>membre de l'association</p>
            <p className="col-span-2"><span className="text-warm-600">Objet : </span>dépenses avancées personnellement pour le compte de l'association</p>
          </section>

          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="border-y-2 border-warm-800 text-left">
                <th className="py-1.5 pr-2 font-semibold">Date</th>
                <th className="py-1.5 pr-2 font-semibold">Pièce</th>
                <th className="py-1.5 pr-2 font-semibold">Nature de la dépense</th>
                <th className="py-1.5 pr-2 font-semibold">Justificatif</th>
                <th className="py-1.5 font-semibold text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {m.avances.map(a => (
                <tr key={a.id} className="border-b border-warm-200 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{frDate(a.date)}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{a.number}</td>
                  <td className="py-1.5 pr-2">{a.label}{a.categories ? <span className="block text-warm-600 text-[12px]">{a.categories}</span> : null}</td>
                  <td className="py-1.5 pr-2">{a.attachments ? 'Joint' : 'Manquant'}</td>
                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{formatEuros(a.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="pt-2 text-right">Total des frais avancés</td><td className="pt-2 text-right tabular-nums">{formatEuros(m.avance)}</td></tr>
              {m.rembourse > 0 && (
                <tr><td colSpan={4} className="text-right">Déjà remboursé</td><td className="text-right tabular-nums">-{formatEuros(m.rembourse)}</td></tr>
              )}
              <tr className="font-bold text-[15px]"><td colSpan={4} className="pt-1 text-right">Montant à rembourser</td><td className="pt-1 text-right tabular-nums">{formatEuros(m.du)}</td></tr>
            </tfoot>
          </table>

          <section className="mb-6 space-y-1">
            <p><span className="text-warm-600">Mode de remboursement : </span>
              <span className="mr-4"><Box checked />Virement</span>
              <span className="mr-4"><Box />Espèces</span>
              <span><Box />Chèque</span>
            </p>
            <p><span className="text-warm-600">IBAN du bénéficiaire (si virement) : </span>
              <span className="inline-block w-[95mm] border-b border-warm-400">&nbsp;</span></p>
            {m.remboursements.length > 0 && (
              <p className="text-warm-700">Remboursement{m.remboursements.length > 1 ? 's' : ''} déjà enregistré{m.remboursements.length > 1 ? 's' : ''} :{' '}
                {m.remboursements.map(r => `${r.number} du ${frDate(r.date)} (${formatEuros(r.amount)})`).join(', ')}.</p>
            )}
          </section>

          <p className="mb-8">
            Je certifie avoir avancé les dépenses ci-dessus pour le compte de l'association, sans en avoir obtenu le remboursement
            par ailleurs. Les justificatifs originaux sont joints ou conservés par l'association.
          </p>

          <section className="grid grid-cols-2 gap-8">
            <div className="border border-warm-300 rounded p-3 h-[36mm]">
              <p className="font-semibold">Le bénéficiaire</p>
              <p className="text-warm-600 text-[12px]">Date et signature</p>
            </div>
            <div className="border border-warm-300 rounded p-3 h-[36mm]">
              <p className="font-semibold">Pour l'association</p>
              <p className="text-warm-600 text-[12px]">Le trésorier ou le président. « Bon pour remboursement », date et signature</p>
            </div>
          </section>

          <footer className="mt-8 text-[11px] text-warm-600">
            Document généré depuis l'espace de gestion du {ASSO.nom}. À joindre, signé, à l'opération de remboursement en comptabilité.
          </footer>
        </article>
      )}
    </div>
  );
}
