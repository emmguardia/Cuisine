/**
 * Formulaire de contact du site — public.
 * POST /api/contact → envoie le message au club (réponse directe à
 *                     l'expéditeur) et un accusé de réception à l'expéditeur.
 *
 * Rien n'est stocké. Protections : origine du site (middleware/origin.js),
 * limite stricte par IP, champ piège pour les robots, champs bornés.
 */
import { Router } from 'express';
import { z } from 'zod';
import { contactLimiter } from '../config/security.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../lib/errors.js';
import { CLUB_EMAIL, isMailerConfigured, sendMail } from '../services/mailer.js';

const router = Router();
router.use(contactLimiter);

const oneLine = (max) => z.string().trim().min(1).max(max).refine(v => !/[\r\n]/.test(v), 'Une seule ligne');

export const ContactInput = z.object({
  // Lettres, espaces, apostrophes, points, tirets : le nom figure dans
  // l'accusé de réception, il ne doit pas pouvoir porter un lien.
  name:    oneLine(80).refine(v => /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u.test(v), 'Nom invalide'),
  email:   z.email().max(254),
  subject: oneLine(150),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional(), // piège : invisible, rempli par les robots
});

const PARIS = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });
const UNAVAILABLE = `L'envoi est momentanément indisponible. Écrivez-nous à ${CLUB_EMAIL}.`;

router.post('/', validate({ body: ContactInput }), async (req, res) => {
  const { name, email, subject, message, website } = req.valid.body;
  if (website) return res.status(204).end();
  if (!isMailerConfigured()) throw new HttpError(503, UNAVAILABLE);

  try {
    await sendMail({
      template: 'contact',
      to: CLUB_EMAIL,
      toName: 'Club Quisine',
      replyTo: email,
      variables: { sender_name: name, sender_email: email, subject, message, received_at: PARIS.format(new Date()) },
    });
  } catch (err) {
    console.error('[contact] envoi au club', err.message);
    throw new HttpError(502, UNAVAILABLE);
  }

  // Le message est parti : un accusé de réception manqué ne doit pas le faire renvoyer.
  await sendMail({ template: 'contact-sent', to: email, toName: name, variables: { subject } })
    .catch(err => console.error('[contact] accusé de réception', err.message));

  res.status(204).end();
});

export default router;
