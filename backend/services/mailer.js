/**
 * Envoi d'emails par l'Email-Service du cluster.
 *
 * Le backend signe un jeton RS256 court avec la clé privée partagée
 * (EMAIL_SERVICE_JWT_PRIVATE_KEY, scellée dans quisine-secrets) ; le service
 * le vérifie avec la clé publique et n'accepte que le projet du jeton.
 * Les modèles sont dans le dépôt Email-Service : templates/club-quisine/.
 */
import { createSign } from 'crypto';

export const PROJECT = 'club-quisine';
export const CLUB_EMAIL = process.env.CONTACT_EMAIL || 'clubquisine@guardiaschool.fr';

const SERVICE_URL = () =>
  (process.env.EMAIL_SERVICE_URL || 'http://email-service.email-service.svc.cluster.local:8080').replace(/\/+$/, '');
const TIMEOUT_MS = 10_000;

export const isMailerConfigured = () => Boolean(process.env.EMAIL_SERVICE_JWT_PRIVATE_KEY);

const b64url = (value) => Buffer.from(value).toString('base64url');

/* Jeton de 5 minutes, signé à chaque envoi : rien n'est conservé en mémoire. */
export function signToken(privateKey, now = Math.floor(Date.now() / 1000)) {
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    project: PROJECT, permissions: ['send_email'], iss: 'email-service', iat: now, exp: now + 300,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Envoie un modèle. Lève une erreur (sans détail du service) en cas d'échec.
 * @param {object} mail { template, to, toName, variables, replyTo }
 */
export async function sendMail({ template, to, toName, variables = {}, replyTo }) {
  const key = process.env.EMAIL_SERVICE_JWT_PRIVATE_KEY;
  if (!key) throw new Error('Email-Service non configuré');

  const res = await fetch(`${SERVICE_URL()}/api/v1/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken(key)}` },
    body: JSON.stringify({
      project: PROJECT,
      template_id: template,
      to_email: to,
      to_name: toName,
      variables,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Email-Service a répondu ${res.status} (${template})`);
}
