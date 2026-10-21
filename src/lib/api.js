const BASE = '/api';

async function req(path, options = {}) {
  const { body, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...rest.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...rest,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status  = res.status;
    err.code    = data.code;
    err.details = data.details;
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  contact: {
    send: (data) => req('/contact', { method: 'POST', body: data }),
  },

  recipes: {
    list:   ()        => req('/recipes'),
    mine:   ()        => req('/recipes/mine'),
    get:    (id)      => req(`/recipes/${id}`),
    create: (data)    => req('/recipes',      { method: 'POST',   body: data }),
    update: (id, data)=> req(`/recipes/${id}`,{ method: 'PUT',    body: data }),
    delete: (id)      => req(`/recipes/${id}`,{ method: 'DELETE' }),
  },

  admin: {
    recipes:        ()          => req('/admin/recipes'),
    users:          ()          => req('/admin/users'),
    deleteUser:     (id)        => req(`/admin/users/${id}`,  { method: 'DELETE' }),
    emails:         ()          => req('/admin/emails'),
    addEmail:       (data)      => req('/admin/emails',        { method: 'POST',   body: data }),
    deleteEmail:    (id)        => req(`/admin/emails/${id}`,  { method: 'DELETE' }),
  },

  /* Demandes à double validation */
  requests: {
    list:    (status = 'pending') => req(`/admin/requests?status=${encodeURIComponent(status)}`),
    summary: ()                   => req('/admin/requests/summary'),
    create:  (data)               => req('/admin/requests',              { method: 'POST', body: data }),
    approve: (id, comment)        => req(`/admin/requests/${id}/approve`, { method: 'POST', body: comment ? { comment } : {} }),
    reject:  (id, comment)        => req(`/admin/requests/${id}/reject`,  { method: 'POST', body: comment ? { comment } : {} }),
    cancel:  (id)                 => req(`/admin/requests/${id}/cancel`,  { method: 'POST' }),
  },

  audit: {
    list: (params = {}) => req(`/admin/audit?${new URLSearchParams(params)}`),
  },

  compta: {
    meta:       ()             => req('/admin/compta/meta'),
    summary:    ()             => req('/admin/compta/summary'),
    list:       (params = {})  => req(`/admin/compta/operations?${new URLSearchParams(params)}`),
    get:        (id)           => req(`/admin/compta/operations/${id}`),
    check:      (op)           => req('/admin/compta/operations/check', { method: 'POST', body: op }),
    create:     (op)           => req('/admin/compta/operations',       { method: 'POST', body: op }),
    correct:    (id, op)       => req(`/admin/compta/operations/${id}`, { method: 'PUT',  body: op }),
    remboursements: (membre) => req(`/admin/compta/remboursements${membre ? `?membre=${encodeURIComponent(membre)}` : ''}`),
    importLot:  (lot, dryRun)  => req(`/admin/compta/import?dry_run=${dryRun ? 1 : 0}`, { method: 'POST', body: lot }),
    attachmentUrl: (id, download = false) => `${BASE}/admin/compta/attachments/${id}${download ? '?download=1' : ''}`,
  },

  membres: {
    list:   (params = {}) => req(`/admin/membres?${new URLSearchParams(params)}`),
    create: (data)        => req('/admin/membres',       { method: 'POST',   body: data }),
    update: (id, data)    => req(`/admin/membres/${id}`, { method: 'PUT',    body: data }),
    remove: (id)          => req(`/admin/membres/${id}`, { method: 'DELETE' }),
    setSchoolEmail: (id, email) => req(`/admin/membres/${id}/mail-guardia`, { method: 'PATCH', body: { school_email: email || null } }),
    addToTeam: (id, role)       => req(`/admin/membres/${id}/equipe`,        { method: 'POST',  body: role ? { role } : {} }),
  },

  integrations: {
    status: ()         => req('/admin/integrations'),
    sync:   (provider) => req(`/admin/integrations/${provider}/sync`, { method: 'POST' }),
  },

  materiel: {
    list:     (params = {}) => req(`/admin/materiel?${new URLSearchParams(params)}`),
    get:      (id)          => req(`/admin/materiel/${id}`),
    create:   (data)        => req('/admin/materiel',       { method: 'POST', body: data }),
    update:   (id, data)    => req(`/admin/materiel/${id}`, { method: 'PUT',  body: data }),
    photoUrl: (id, v = '')  => `${BASE}/admin/materiel/${id}/photo${v ? `?v=${v}` : ''}`,
    checks:   ()            => req('/admin/materiel/inventaires'),
    startCheck: (date)      => req('/admin/materiel/inventaires', { method: 'POST', body: { date } }),
    getCheck: (id)          => req(`/admin/materiel/inventaires/${id}`),
    setLine:  (id, eqId, data) => req(`/admin/materiel/inventaires/${id}/lignes/${eqId}`, { method: 'PUT', body: data }),
    validate: (id)          => req(`/admin/materiel/inventaires/${id}/valider`,    { method: 'POST' }),
    abandon:  (id)          => req(`/admin/materiel/inventaires/${id}/abandonner`, { method: 'POST' }),
  },

  evenements: {
    list:   ()                 => req('/admin/evenements'),
    get:    (id)               => req(`/admin/evenements/${id}`),
    create: (data)             => req('/admin/evenements',       { method: 'POST',   body: data }),
    update: (id, data)         => req(`/admin/evenements/${id}`, { method: 'PUT',    body: data }),
    remove: (id)               => req(`/admin/evenements/${id}`, { method: 'DELETE' }),
    link:   (id, entryId, amount) => req(`/admin/evenements/${id}/operations`, { method: 'POST', body: { entry_id: entryId, amount: amount ?? null } }),
    unlink: (id, originId)     => req(`/admin/evenements/${id}/operations/${originId}`, { method: 'DELETE' }),
  },

  team: {
    list:   ()         => req('/team'),
    create: (data)     => req('/team',      { method: 'POST',   body: data }),
    update: (id, data) => req(`/team/${id}`,{ method: 'PUT',    body: data }),
    delete: (id)       => req(`/team/${id}`,{ method: 'DELETE' }),
  },

  upload: {
    presign: (filename, folder = 'recettes') =>
      req(`/upload/presign?filename=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`),
  },
};

/** Taille max d'upload (garde pratique : presign R2 ne peut pas la borner côté serveur) */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Upload direct vers R2 via presigned URL */
export async function uploadToR2(file, folder = 'recettes') {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image trop lourde (max 5 Mo)');
  }
  const { uploadUrl, publicUrl } = await api.upload.presign(file.name, folder);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Échec upload R2 (${res.status})${text ? ' : ' + text : ''}`);
  }
  return publicUrl;
}

/** Joint un justificatif (corps binaire) à une opération. */
export async function uploadAttachment(operationId, blob, filename) {
  const res = await fetch(
    `${BASE}/admin/compta/operations/${operationId}/attachments?filename=${encodeURIComponent(filename)}`,
    { method: 'POST', credentials: 'include', headers: { 'Content-Type': blob.type }, body: blob }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/** Photo d'une fiche matériel (corps binaire). */
export async function uploadEquipmentPhoto(id, blob) {
  const res = await fetch(`${BASE}/admin/materiel/${id}/photo`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': blob.type }, body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
}
