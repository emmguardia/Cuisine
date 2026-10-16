/**
 * Lecture d'une colonne JSON. Selon la version de MariaDB et de mysql2, la
 * valeur arrive déjà décodée (MariaDB 11.x annonce le type JSON) ou en texte :
 * on accepte les deux.
 */
export function jsonColumn(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const jsonArray = (value) => {
  const v = jsonColumn(value, []);
  return Array.isArray(v) ? v : [];
};
