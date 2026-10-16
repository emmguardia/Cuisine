/* Montants : toujours des centimes entiers côté code, jamais de flottants. */

/** "12,50" | "12.5" | "-3" → centimes (entier signé), ou null si invalide. */
export function parseEuros(input) {
  const s = String(input ?? '').trim().replace(/\s| |€/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith('-');
  const [int, dec = ''] = s.replace('-', '').split('.');
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  return negative ? -cents : cents;
}

export function formatEuros(cents, { sign = false } = {}) {
  const n = Number(cents) || 0;
  const abs = Math.abs(n);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const prefix = n < 0 ? '-' : sign && n > 0 ? '+' : '';
  return `${prefix}${euros},${String(abs % 100).padStart(2, '0')} €`;
}

/** Valeur à afficher dans un champ de saisie (12,50). */
export function centsToInput(cents) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

export const frDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const KIND_LABELS = { recette: 'Recette', depense: 'Dépense', virement: 'Virement interne', contrepassation: 'Écriture inverse' };
