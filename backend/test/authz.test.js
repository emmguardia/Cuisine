/**
 * Contrôle d'accès de TOUTES les routes montées dans app.js.
 *
 * Le test énumère les routes de chaque routeur de ROUTES : une route ajoutée
 * sans protection fait échouer la CI. Aucune base de données n'est nécessaire,
 * les refus ont lieu avant tout accès SQL.
 *
 * Règles :
 *  - hors liste PUBLIC, sans session → 401 ;
 *  - sous /api/admin, et pour les modifications de /api/team, un membre → 403.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const ORIGIN = 'https://quisine.test';
const WEBHOOK_TOKEN = 'a'.repeat(64);
process.env.HELLOASSO_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
process.env.ALLOWED_ORIGINS = ORIGIN;
process.env.BETTER_AUTH_URL = ORIGIN;

const { createApp, ROUTES } = await import('../app.js');
const { sessionProvider } = await import('../middleware/auth.js');

/* Routes lisibles sans session. Toute autre route doit exiger une connexion. */
const PUBLIC = new Set([
  'GET /api/recipes',
  'GET /api/recipes/:id',
  'GET /api/team',
  'POST /api/contact',
]);

const ADMIN_ONLY = (method, path) =>
  path.startsWith('/api/admin') || (path.startsWith('/api/team') && method !== 'GET');

const FAKE_ID = '0b9f3c1e-6a2d-4c8e-9f1a-2b3c4d5e6f70';

const USERS = {
  membre: { id: 'u-membre', name: 'Membre', email: 'membre@test.fr', role: 'membre' },
  admin:  { id: 'u-admin',  name: 'Admin',  email: 'admin@test.fr',  role: 'admin' },
};

let server;
let base;

before(async () => {
  sessionProvider.get = async (req) => {
    const who = req.headers['x-test-user'];
    if (!who) return null;
    const createdAt = req.headers['x-test-session-age'] === 'old'
      ? new Date(Date.now() - 60 * 60_000)
      : new Date();
    return { user: USERS[who], session: { id: 's', createdAt } };
  };
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

function listRoutes() {
  const routes = [];
  for (const { path: mount, router } of ROUTES) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        const sub = layer.route.path === '/' ? '' : layer.route.path;
        routes.push({ method: method.toUpperCase(), path: mount + sub });
      }
    }
  }
  return routes;
}

function call(method, path, { user, origin = ORIGIN, body, headers = {} } = {}) {
  const url = base + path.replace(/:id\b/g, FAKE_ID).replace(/:[a-zA-Z_]+/g, 'x');
  return fetch(url, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(user ? { 'x-test-user': user } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test('la table de routes n\'est pas vide', () => {
  assert.ok(listRoutes().length > 15);
});

test('toute route non publique refuse un visiteur sans session (401)', async () => {
  for (const { method, path } of listRoutes()) {
    if (PUBLIC.has(`${method} ${path}`)) continue;
    const res = await call(method, path);
    assert.equal(res.status, 401, `${method} ${path} devrait renvoyer 401, reçu ${res.status}`);
  }
});

test('toute route admin refuse un membre (403)', async () => {
  for (const { method, path } of listRoutes()) {
    if (!ADMIN_ONLY(method, path)) continue;
    const res = await call(method, path, { user: 'membre' });
    assert.equal(res.status, 403, `${method} ${path} devrait renvoyer 403, reçu ${res.status}`);
  }
});

test('une route admin inconnue ne fuit rien sans session', async () => {
  const res = await call('GET', '/api/admin/nexiste-pas');
  assert.equal(res.status, 401);
});

test('modification sans en-tête Origin → 403', async () => {
  const res = await call('POST', '/api/admin/requests', { user: 'admin', origin: null, body: {} });
  assert.equal(res.status, 403);
});

test('modification depuis une autre origine → 403', async () => {
  const res = await call('DELETE', '/api/admin/emails/1', { user: 'admin', origin: 'https://evil.example' });
  assert.equal(res.status, 403);
});

test('corps non JSON → 415', async () => {
  const res = await fetch(`${base}/api/admin/requests`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'x-test-user': 'admin', 'content-type': 'text/plain' },
    body: 'type=x',
  });
  assert.equal(res.status, 415);
});

test('valider une demande exige une connexion récente', async () => {
  const res = await call('POST', '/api/admin/requests/:id/approve', {
    user: 'admin', body: {}, headers: { 'x-test-session-age': 'old' },
  });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'REAUTH_REQUIRED');
});

test('les entrées invalides sont refusées avant la base', async () => {
  const res = await call('POST', '/api/admin/requests', {
    user: 'admin', body: { type: 'user.set_role', reason: 'ok', champ_inconnu: 1 },
  });
  assert.equal(res.status, 400);
});

test('ajouter un email admin en direct est refusé (double validation)', async () => {
  const res = await call('POST', '/api/admin/emails', {
    user: 'admin', body: { email: 'nouveau@test.fr', role: 'admin' },
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'REQUEST_REQUIRED');
});

test('la route de changement de rôle direct n\'existe plus', async () => {
  const res = await call('PATCH', `/api/admin/users/${FAKE_ID}`, { user: 'admin', body: { role: 'admin' } });
  assert.equal(res.status, 404);
});

test('webhook HelloAsso : mauvais jeton → 404, bon jeton → 202 (sans session ni Origin)', async () => {
  const post = (token) => fetch(`${base}/api/webhooks/helloasso/${token}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"eventType":"Payment"}',
  });
  assert.equal((await post('b'.repeat(64))).status, 404);
  assert.equal((await post('court')).status, 404);
  assert.equal((await post(WEBHOOK_TOKEN)).status, 202);
});
