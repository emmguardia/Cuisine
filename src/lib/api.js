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
    throw new Error(data.error || `Erreur ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
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
    updateUserRole: (id, role)  => req(`/admin/users/${id}`,  { method: 'PATCH',  body: { role } }),
    deleteUser:     (id)        => req(`/admin/users/${id}`,  { method: 'DELETE' }),
    emails:         ()          => req('/admin/emails'),
    addEmail:       (data)      => req('/admin/emails',        { method: 'POST',   body: data }),
    updateEmailRole:(id, role)  => req(`/admin/emails/${id}`, { method: 'PATCH',  body: { role } }),
    deleteEmail:    (id)        => req(`/admin/emails/${id}`,  { method: 'DELETE' }),
  },

  upload: {
    presign: (filename) => req(`/upload/presign?filename=${encodeURIComponent(filename)}`),
  },
};

/** Upload direct vers R2 via presigned URL */
export async function uploadToR2(file) {
  const { uploadUrl, publicUrl } = await api.upload.presign(file.name);
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  return publicUrl;
}
