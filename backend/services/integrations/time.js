/* Dates « comptables » : le jour d'une vente est celui de Paris, pas d'UTC. */
const PARIS = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** '2026-10-16T22:30:00Z' → '2026-10-17' (minuit passé à Paris). */
export const parisDay = (value) => PARIS.format(new Date(value));

export const frDay = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Saison associative (août → juillet) d'une date. */
export function seasonOf(iso) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}
