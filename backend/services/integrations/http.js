/**
 * Appels HTTP sortants vers SumUp et HelloAsso.
 * - User-Agent explicite : sans lui, le pare-feu de HelloAsso répond 403 ;
 * - délai maximal de 20 s ;
 * - les messages d'erreur ne reprennent jamais les en-têtes (jetons).
 */
export const USER_AGENT = 'ClubQuisine-Compta/1.0 (+https://quisine.zenixweb.fr)';

export class IntegrationError extends Error {}

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 20_000 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
  } catch (err) {
    throw new IntegrationError(`${new URL(url).host} injoignable (${err.name === 'TimeoutError' ? 'délai dépassé' : err.message})`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new IntegrationError(`${new URL(url).host} a répondu ${res.status}`);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new IntegrationError(`${new URL(url).host} : réponse illisible`);
  }
}
