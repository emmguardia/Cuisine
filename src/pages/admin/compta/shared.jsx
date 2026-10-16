import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { formatEuros } from './money';

/* ─── Référentiels compta (catégories, moyens de paiement), mis en cache ── */
let metaCache = null;
export function useComptaMeta() {
  const [meta, setMeta] = useState(metaCache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (metaCache) return;
    api.compta.meta()
      .then(m => { metaCache = m; setMeta(m); })
      .catch(err => setError(err.message));
  }, []);
  return { meta, error };
}

export function categoryLabel(meta, id) {
  return meta?.categories.find(c => c.id === id)?.label ?? id;
}

export const TREASURY_SHORT = {
  banque: 'Banque', caisse: 'Caisse', sumup: 'SumUp', helloasso: 'HelloAsso', membre: 'Avance membre',
};

export function treasuryText(op) {
  if (op.kind === 'virement') return `${TREASURY_SHORT[op.from] ?? '?'} → ${TREASURY_SHORT[op.to] ?? '?'}`;
  return TREASURY_SHORT[op.treasury] ?? '';
}

/** Montant signé et coloré selon le sens de l'opération. */
export function Amount({ kind, cents, className = '' }) {
  const tone = kind === 'recette' ? 'text-green-800' : kind === 'depense' ? 'text-warm-900' : 'text-warm-600';
  const prefix = kind === 'recette' ? '+' : kind === 'depense' ? '-' : '';
  return (
    <span className={`font-nunito font-semibold tabular-nums whitespace-nowrap ${tone} ${className}`}>
      {prefix}{formatEuros(cents)}
    </span>
  );
}

const STATUS = {
  active:    null,
  replaced:  { label: 'Corrigée',  cls: 'bg-warm-100 text-warm-600' },
  cancelled: { label: 'Annulée',   cls: 'bg-red-100 text-red-700' },
};
export function EntryStatus({ status }) {
  const s = STATUS[status];
  if (!s) return null;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

/* ─── Préparation des justificatifs avant envoi ─────────────────────────
 * Les photos sont réencodées en JPEG (2000 px max) : cela retire les
 * métadonnées EXIF (dont la position GPS du téléphone) et allège l'envoi.
 * Les PDF partent tels quels. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function prepareFile(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} : PDF trop lourd (8 Mo maximum)`);
    return { blob: file, name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} : format refusé (photo ou PDF uniquement)`);

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} : image illisible par le navigateur (essayez en JPEG)`);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob || blob.size > MAX_BYTES) throw new Error(`${file.name} : image trop lourde`);
  return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
}

/** Sélection de justificatifs : appareil photo ou fichiers. */
export function FilePicker({ files, onChange, disabled }) {
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const add = (list) => onChange([...files, ...Array.from(list || [])]);
  const btnCls = 'px-3 py-2 text-sm font-semibold text-orange-700 border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-60';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnCls} disabled={disabled} onClick={() => cameraRef.current?.click()}>
          Prendre une photo
        </button>
        <button type="button" className={btnCls} disabled={disabled} onClick={() => fileRef.current?.click()}>
          Choisir un fichier
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { add(e.target.files); e.target.value = ''; }} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden"
          onChange={e => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <ul className="text-sm font-nunito text-warm-700 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="truncate">{f.name}</span>
              <span className="text-warm-400 text-xs">{Math.round(f.size / 1024)} Ko</span>
              <button type="button" className="text-xs font-semibold text-red-600 hover:underline"
                onClick={() => onChange(files.filter((_, j) => j !== i))}>Retirer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SummaryCard({ label, value, hint, tone = 'default' }) {
  const color = tone === 'negative' ? 'text-red-700' : tone === 'positive' ? 'text-green-800' : 'text-warm-900';
  return (
    <div className="bg-white rounded-2xl border border-warm-100 p-4">
      <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">{label}</p>
      <p className={`font-nunito text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
      {hint && <p className="font-nunito text-xs text-warm-500 mt-1">{hint}</p>}
    </div>
  );
}
