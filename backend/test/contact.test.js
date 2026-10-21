/**
 * Formulaire de contact : envoi par l'Email-Service, simulé ici par un petit
 * serveur local qui enregistre les requêtes reçues.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync, createVerify } from 'node:crypto';

const ORIGIN = 'https://quisine.test';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.ALLOWED_ORIGINS = ORIGIN;
process.env.BETTER_AUTH_URL = ORIGIN;
process.env.EMAIL_SERVICE_JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });

let received = [];
let failWith = null;
const fake = createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
    res.writeHead(failWith ?? 200, { 'content-type': 'application/json' }).end('{"success":true}');
  });
});

let server;
let base;

before(async () => {
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  process.env.EMAIL_SERVICE_URL = `http://127.0.0.1:${fake.address().port}`;
  const { createApp } = await import('../app.js');
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); fake.close(); });
beforeEach(() => { received = []; failWith = null; });

const VALID = {
  name: 'Jeanne Dupont',
  email: 'jeanne@example.fr',
  subject: 'Atelier crêpes',
  message: 'Bonjour, pourrait-on organiser un atelier ensemble ?',
};

let ip = 0;
const send = (body, { origin = ORIGIN } = {}) => fetch(`${base}/api/contact`, {
  method: 'POST',
  // Une IP par requête : la limite par IP est testée à part.
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}`, ...(origin ? { origin } : {}) },
  body: JSON.stringify(body),
});

function verifyJwt(auth) {
  const [h, p, s] = auth.replace(/^Bearer /, '').split('.');
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, s, 'base64url'), 'signature RS256 valide');
  return JSON.parse(Buffer.from(p, 'base64url').toString());
}

test('envoie le message au club puis un accusé de réception', async () => {
  const res = await send(VALID);
  assert.equal(res.status, 204);
  assert.equal(received.length, 2);

  const [club, ack] = received;
  assert.equal(club.url, '/api/v1/send');
  assert.equal(club.body.project, 'club-quisine');
  assert.equal(club.body.template_id, 'contact');
  assert.equal(club.body.to_email, 'clubquisine@guardiaschool.fr');
  assert.equal(club.body.reply_to, VALID.email);
  assert.equal(club.body.variables.message, VALID.message);

  assert.equal(ack.body.template_id, 'contact-sent');
  assert.equal(ack.body.to_email, VALID.email);
  assert.equal(ack.body.variables.message, undefined, 'l\'accusé ne recopie pas le message');

  const claims = verifyJwt(club.auth);
  assert.equal(claims.project, 'club-quisine');
  assert.equal(claims.iss, 'email-service');
  assert.ok(claims.exp - claims.iat <= 300);
});

test('champ piège rempli : réponse normale, rien n\'est envoyé', async () => {
  const res = await send({ ...VALID, website: 'http://spam.example' });
  assert.equal(res.status, 204);
  assert.equal(received.length, 0);
});

test('entrées invalides refusées sans envoi', async () => {
  for (const body of [
    { ...VALID, email: 'pas-un-email' },
    { ...VALID, name: 'Visitez http://spam.example' },
    { ...VALID, subject: 'ligne\nBcc: x@example.fr' },
    { ...VALID, message: 'court' },
    { ...VALID, message: 'x'.repeat(5001) },
  ]) {
    const res = await send(body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.equal(received.length, 0);
});

test('autre origine → 403', async () => {
  const res = await send(VALID, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(received.length, 0);
});

test('Email-Service en erreur → 502 avec l\'adresse du club', async () => {
  failWith = 500;
  const res = await send(VALID);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /clubquisine@guardiaschool\.fr/);
  assert.equal(received.length, 1, 'pas d\'accusé si le message n\'est pas parti');
});

test('limite : 5 messages par heure et par IP', async () => {
  const headers = { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': '198.51.100.7' };
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${base}/api/contact`, { method: 'POST', headers, body: JSON.stringify(VALID) });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [204, 204, 204, 204, 204, 429]);
});
