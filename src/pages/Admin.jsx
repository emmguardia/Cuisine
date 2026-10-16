import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authClient } from '../lib/auth-client';
import { api, uploadToR2 } from '../lib/api';
import { usePathname, onLinkClick } from '../lib/router';
import { RecipeModal } from './Dashboard';
import { RoleBadge, TableSkeleton, Empty, Notice, PageTitle, RequestDialog, btn, input } from './admin/ui';
import Overview from './admin/Overview';
import Requests from './admin/Requests';
import Audit from './admin/Audit';
import Operations from './admin/compta/Operations';
import OperationForm from './admin/compta/OperationForm';
import OperationDetail from './admin/compta/OperationDetail';
import Caisse from './admin/compta/Caisse';
import Import from './admin/compta/Import';
import Members from './admin/Members';
import { EventsList, EventDetail } from './admin/Events';
import { navigate } from '../lib/router';

const REQUEST_SENT = 'Demande envoyée. Elle sera appliquée après validation par un autre membre du bureau.';

/* ─── Onglet Recettes ────────────────────────────────────────────────── */
function AdminRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.admin.recipes()
      .then(d => setRecipes(d.recipes || []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id, title) => {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    await api.recipes.delete(id);
    setRecipes(rs => rs.filter(r => r.id !== id));
  };

  if (loading) return <TableSkeleton cols={5} />;

  return (
    <>
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="font-nunito text-warm-500">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</p>
      </div>

      {recipes.length === 0 ? (
        <Empty message="Aucune recette publiée pour l'instant." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-orange-50">
                {['Recette', 'Auteur', 'Difficulté', 'Date', ''].map(h => (
                  <th key={h} className="px-5 py-4 font-nunito text-xs font-bold uppercase tracking-wider text-warm-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipes.map(r => (
                <tr key={r.id} className="border-b border-orange-50 last:border-none hover:bg-orange-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {r.image_url && (
                        <img src={r.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-nunito font-semibold text-warm-800 text-sm leading-tight">{r.title}</p>
                        <p className="font-nunito text-xs text-warm-400 mt-0.5">
                          {(r.tags || []).slice(0,2).join(', ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-nunito text-sm text-warm-700">{r.author_name}</p>
                    <p className="font-nunito text-xs text-warm-400">{r.author_email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <DiffBadge d={r.difficulty} />
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-nunito text-xs text-warm-500">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2 justify-end">
                      <a href={`/recette?id=${r.slug}`} target="_blank" rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                        Voir
                      </a>
                      <button onClick={() => setEditing(r)}
                        className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                        Modifier
                      </button>
                      <button onClick={() => handleDelete(r.id, r.title)}
                        className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {editing && (
      <RecipeModal
        recipe={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    )}
    </>
  );
}

/* ─── Comptes inscrits ───────────────────────────────────────────────── */
function AdminUsers({ currentUserId, onRequestCreated }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog]   = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError]     = useState(null);

  const load = () => {
    setLoading(true);
    api.admin.users()
      .then(d => setUsers(d.users || []))
      .catch(err => { setUsers([]); setError(err.message); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const askRole = (u) => {
    const role = u.role === 'admin' ? 'membre' : 'admin';
    setDialog({
      title:   role === 'admin' ? 'Nommer administrateur' : 'Retirer les droits administrateur',
      summary: `${u.name} (${u.email}) : ${role === 'admin' ? 'Membre → Administrateur' : 'Administrateur → Membre'}`,
      request: { type: 'user.set_role', target_id: u.id, payload: { role } },
    });
  };

  const handleDelete = async (u) => {
    setError(null);
    if (u.role === 'admin') {
      setDialog({
        title:   'Supprimer un compte administrateur',
        summary: `${u.name} (${u.email}) : le compte sera supprimé et son accès retiré.`,
        request: { type: 'user.delete_admin', target_id: u.id, payload: {} },
      });
      return;
    }
    if (!confirm(`Supprimer le compte de ${u.name} ? Ses recettes seront aussi supprimées.`)) return;
    try {
      await api.admin.deleteUser(u.id);
      setUsers(us => us.filter(x => x.id !== u.id));
      setMessage('Compte supprimé.');
    } catch (err) {
      setError(err.message);
    }
  };

  const submitRequest = async (reason) => {
    await api.requests.create({ ...dialog.request, reason });
    setDialog(null);
    setMessage(REQUEST_SENT);
    onRequestCreated?.();
  };

  return (
    <div>
      <PageTitle title="Comptes" subtitle={loading ? null : `${users.length} compte${users.length > 1 ? 's' : ''} inscrit${users.length > 1 ? 's' : ''}`} />

      <div className="space-y-4">
        {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
        {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

        {loading ? <TableSkeleton cols={4} /> : users.length === 0 ? (
          <Empty message="Aucun compte inscrit pour l'instant." />
        ) : (
          <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-warm-100">
                  {['Compte', 'Rôle', 'Inscription', ''].map(h => (
                    <th key={h} className="px-5 py-3 font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-warm-50 last:border-none">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {u.image
                          ? <img src={u.image} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
                          : <span className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 text-sm font-semibold flex items-center justify-center">
                              {(u.name || '?')[0].toUpperCase()}
                            </span>
                        }
                        <div>
                          <p className="font-nunito font-semibold text-warm-800 text-sm">{u.name}</p>
                          <p className="font-nunito text-xs text-warm-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3">
                      <p className="font-nunito text-xs text-warm-500">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</p>
                    </td>
                    <td className="px-5 py-3">
                      {u.id !== currentUserId && (
                        <div className="flex gap-2 justify-end whitespace-nowrap">
                          <button onClick={() => askRole(u)} className={btn.small}>
                            {u.role === 'admin' ? 'Retirer admin' : 'Nommer admin'}
                          </button>
                          <button onClick={() => handleDelete(u)} className={btn.danger}>Supprimer</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <RequestDialog title={dialog.title} summary={dialog.summary}
          onSubmit={submitRequest} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/* ─── Emails autorisés (liste blanche de connexion) ──────────────────── */
function AdminEmails({ currentEmail, onRequestCreated }) {
  const [emails, setEmails]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole]   = useState('membre');
  const [adding, setAdding]     = useState(false);
  const [dialog, setDialog]     = useState(null);
  const [message, setMessage]   = useState(null);
  const [error, setError]       = useState(null);

  const load = () => {
    setLoading(true);
    api.admin.emails()
      .then(d => setEmails(d.emails || []))
      .catch(err => { setEmails([]); setError(err.message); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setError(null);

    if (newRole === 'admin') {
      setDialog({
        title:   'Ajouter un administrateur',
        summary: `${email} pourra se connecter avec les droits administrateur.`,
        request: { type: 'email.add_admin', target_id: email, payload: {} },
        onSent:  () => setNewEmail(''),
      });
      return;
    }

    setAdding(true);
    try {
      const entry = await api.admin.addEmail({ email, role: newRole });
      setEmails(es => [...es, entry]);
      setNewEmail('');
      setMessage(`${email} peut maintenant se connecter.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const askRole = (entry) => {
    const role = entry.role === 'admin' ? 'membre' : 'admin';
    setDialog({
      title:   role === 'admin' ? 'Nommer administrateur' : 'Retirer les droits administrateur',
      summary: `${entry.email} : ${role === 'admin' ? 'Membre → Administrateur' : 'Administrateur → Membre'}`,
      request: { type: 'email.set_role', target_id: String(entry.id), payload: { role } },
    });
  };

  const handleDelete = async (entry) => {
    setError(null);
    if (entry.role === 'admin') {
      setDialog({
        title:   'Retirer un administrateur',
        summary: `${entry.email} ne pourra plus se connecter et ses sessions seront fermées.`,
        request: { type: 'email.delete_admin', target_id: String(entry.id), payload: {} },
      });
      return;
    }
    if (!confirm(`Retirer ${entry.email} de la liste ? La personne sera déconnectée.`)) return;
    try {
      await api.admin.deleteEmail(entry.id);
      setEmails(es => es.filter(x => x.id !== entry.id));
      setMessage(`${entry.email} a été retiré.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const submitRequest = async (reason) => {
    await api.requests.create({ ...dialog.request, reason });
    dialog.onSent?.();
    setDialog(null);
    setMessage(REQUEST_SENT);
    onRequestCreated?.();
  };

  return (
    <div>
      <PageTitle title="Emails autorisés"
        subtitle="Seules ces adresses peuvent se connecter au site avec Google." />

      <div className="space-y-6">
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-warm-100 p-5 flex flex-col sm:flex-row gap-3">
          <label className="sr-only" htmlFor="new-email">Email</label>
          <input id="new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
            placeholder="prenom.nom@email.fr" className={`${input} flex-1`} />
          <label className="sr-only" htmlFor="new-role">Rôle</label>
          <select id="new-role" value={newRole} onChange={e => setNewRole(e.target.value)} className={`${input} sm:w-48`}>
            <option value="membre">Membre</option>
            <option value="admin">Administrateur</option>
          </select>
          <button type="submit" disabled={adding} className={`${btn.primary} whitespace-nowrap`}>
            {adding ? 'Ajout…' : 'Autoriser'}
          </button>
        </form>

        {message && <Notice tone="success" onClose={() => setMessage(null)}>{message}</Notice>}
        {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

        {loading ? <TableSkeleton cols={3} /> : emails.length === 0 ? (
          <Empty message="Aucun email dans la liste." />
        ) : (
          <div className="bg-white rounded-2xl border border-warm-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-warm-100">
                  {['Email', 'Rôle', 'Ajouté le', ''].map(h => (
                    <th key={h} className="px-5 py-3 font-nunito text-xs font-semibold uppercase tracking-wide text-warm-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id} className="border-b border-warm-50 last:border-none">
                    <td className="px-5 py-3"><p className="font-nunito text-sm font-semibold text-warm-800">{e.email}</p></td>
                    <td className="px-5 py-3"><RoleBadge role={e.role} /></td>
                    <td className="px-5 py-3">
                      <p className="font-nunito text-xs text-warm-500">{new Date(e.created_at).toLocaleDateString('fr-FR')}</p>
                    </td>
                    <td className="px-5 py-3">
                      {e.email.toLowerCase() !== currentEmail?.toLowerCase() && (
                        <div className="flex gap-2 justify-end whitespace-nowrap">
                          <button onClick={() => askRole(e)} className={btn.small}>
                            {e.role === 'admin' ? 'Retirer admin' : 'Nommer admin'}
                          </button>
                          <button onClick={() => handleDelete(e)} className={btn.danger}>Retirer</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <RequestDialog title={dialog.title} summary={dialog.summary}
          onSubmit={submitRequest} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/* ─── Onglet Équipe (membres affichés sur /equipe) ──────────────────── */
function AdminTeam() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name: '', role: '', photo_url: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const load = () => {
    setLoading(true);
    api.team.list()
      .then(d => setMembers(d.members || []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resetForm = () => { setForm({ name: '', role: '', photo_url: '' }); setEditing(null); setError(null); };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const url = await uploadToR2(file, 'membres');
      setForm(f => ({ ...f, photo_url: url }));
    } catch (err) {
      setError('Upload impossible : ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Le nom est requis'); return; }
    setSaving(true); setError(null);
    try {
      if (editing) await api.team.update(editing, form);
      else         await api.team.create(form);
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m) => {
    setEditing(m.id);
    setForm({ name: m.name, role: m.role || '', photo_url: m.photo_url || '' });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (m) => {
    if (!confirm(`Supprimer ${m.name} ? La photo sera aussi retirée du bucket.`)) return;
    await api.team.delete(m.id);
    setMembers(ms => ms.filter(x => x.id !== m.id));
    if (editing === m.id) resetForm();
  };

  return (
    <div className="space-y-8">
      {/* Formulaire ajout / édition */}
      <div className="bg-white rounded-2xl border border-warm-100 p-6">
        <h3 className="font-playfair text-lg font-semibold text-warm-900 mb-4">
          {editing ? 'Modifier le membre' : 'Ajouter un membre'}
        </h3>
        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-orange-50 flex items-center justify-center ring-2 ring-orange-100">
                {form.photo_url
                  ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                  : <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM5 20a7 7 0 0114 0H5z" />
                    </svg>}
              </div>
              <label className="mt-2 block">
                <span className="sr-only">Photo</span>
                <input type="file" accept="image/*" onChange={handleImage}
                  className="block w-full text-xs text-warm-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer" />
              </label>
              {uploading && <p className="text-xs text-orange-500 mt-1">Upload…</p>}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-sm font-semibold text-warm-700 mb-1.5">Nom *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder="Prénom Nom"
                  className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-warm-700 mb-1.5">Rôle (optionnel)</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="Membre, Cuisinier…"
                  className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving || uploading}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-nunito font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-60 whitespace-nowrap">
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Ajouter'}
            </button>
            {editing && (
              <button type="button" onClick={resetForm}
                className="px-6 py-2.5 border-2 border-orange-100 text-warm-600 font-nunito font-semibold rounded-xl hover:bg-orange-50 transition-colors">
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Liste */}
      {loading ? <TableSkeleton cols={3} /> : members.length === 0 ? (
        <Empty message="Aucun membre pour l'instant. Ajoutez-en un ci-dessus." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-warm-100 p-5 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-orange-50 flex items-center justify-center ring-2 ring-orange-100 mb-3">
                {m.photo_url
                  ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                  : <span className="font-playfair text-lg font-semibold text-orange-400">
                      {(m.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
                    </span>}
              </div>
              <p className="font-nunito font-semibold text-warm-800 text-sm leading-tight">{m.name}</p>
              <p className="font-nunito text-xs text-orange-400 font-bold uppercase tracking-wide mt-0.5">{m.role || 'Membre'}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleEdit(m)}
                  className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                  Modifier
                </button>
                <button onClick={() => handleDelete(m)}
                  className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Utilitaires UI ─────────────────────────────────────────────────── */
function DiffBadge({ d }) {
  const colors = { Facile: 'text-green-700 bg-green-50', Moyen: 'text-orange-700 bg-orange-50', Difficile: 'text-red-700 bg-red-50' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[d] || 'text-warm-600 bg-warm-100'}`}>{d}</span>
  );
}

/* ─── Page principale Admin ──────────────────────────────────────────── */
const ICONS = {
  home:     'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  requests: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  history:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  compta:   'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  events:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  members:  'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  caisse:   'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  recipes:  'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  team:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  users:    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  emails:   'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

const NAV = [
  { group: 'Bureau', items: [
    { path: '/admin',            label: 'Tableau de bord',    icon: 'home' },
    { path: '/admin/demandes',   label: 'Demandes à valider', icon: 'requests', badge: true },
    { path: '/admin/historique', label: 'Historique',         icon: 'history' },
  ]},
  { group: 'Gestion', items: [
    { path: '/admin/compta',     label: 'Comptabilité',       icon: 'compta', prefix: true },
    { path: '/admin/caisse',     label: 'Caisse',             icon: 'caisse' },
    { path: '/admin/evenements', label: 'Événements',         icon: 'events', prefix: true },
    { path: '/admin/adherents',  label: 'Adhérents',          icon: 'members' },
  ]},
  { group: 'Site', items: [
    { path: '/admin/recettes',   label: 'Recettes',           icon: 'recipes' },
    { path: '/admin/equipe',     label: 'Équipe',             icon: 'team' },
    { path: '/admin/comptes',    label: 'Comptes',            icon: 'users' },
    { path: '/admin/acces',      label: 'Emails autorisés',   icon: 'emails' },
  ]},
];

function NavLink({ item, active, badge }) {
  return (
    <a href={item.path} onClick={(e) => onLinkClick(e, item.path)} aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl font-nunito text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-orange-100 text-orange-800' : 'text-warm-600 hover:bg-warm-50 hover:text-warm-900'
      }`}>
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[item.icon]} />
      </svg>
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold text-center"
          aria-label={`${badge} en attente`}>{badge}</span>
      )}
    </a>
  );
}

export default function Admin() {
  const { data: session, isPending } = authClient.useSession();
  const path = usePathname().replace(/\/+$/, '') || '/admin';
  const [summary, setSummary] = useState(null);

  const isAdmin = !isPending && session?.user.role === 'admin';

  useEffect(() => {
    if (!isPending && !isAdmin) window.location.href = '/login';
  }, [isPending, isAdmin]);

  const refreshSummary = useCallback(() => {
    api.requests.summary().then(setSummary).catch(() => {});
  }, []);
  useEffect(() => { if (isAdmin) refreshSummary(); }, [isAdmin, path, refreshSummary]);

  if (!isAdmin) return <div className="min-h-screen bg-cream-100" />;

  const user = session.user;

  const operationMatch = path.match(/^\/admin\/compta\/operations\/([0-9a-f-]{36})$/);
  const eventMatch = path.match(/^\/admin\/evenements\/([0-9a-f-]{36})$/);

  let content;
  if (operationMatch) {
    content = <OperationDetail key={operationMatch[1]} id={operationMatch[1]} currentUserId={user.id} />;
  } else if (eventMatch) {
    content = <EventDetail key={eventMatch[1]} id={eventMatch[1]} />;
  } else switch (path) {
    case '/admin/evenements':      content = <EventsList />; break;
    case '/admin/adherents':       content = <Members />; break;
    case '/admin/compta':          content = <Operations />; break;
    case '/admin/compta/nouvelle': content = <><PageTitle title="Nouvelle opération" /><OperationForm onCancel={() => navigate('/admin/compta')} /></>; break;
    case '/admin/compta/import':   content = <Import />; break;
    case '/admin/caisse':          content = <Caisse />; break;
    case '/admin/demandes':   content = <Requests currentUserId={user.id} onChange={refreshSummary} />; break;
    case '/admin/historique': content = <Audit />; break;
    case '/admin/recettes':   content = <><PageTitle title="Recettes" /><AdminRecipes /></>; break;
    case '/admin/equipe':     content = <><PageTitle title="Équipe" subtitle="Membres affichés sur la page publique Notre équipe." /><AdminTeam /></>; break;
    case '/admin/comptes':    content = <AdminUsers currentUserId={user.id} onRequestCreated={refreshSummary} />; break;
    case '/admin/acces':      content = <AdminEmails currentEmail={user.email} onRequestCreated={refreshSummary} />; break;
    default:                  content = <Overview summary={summary} />;
  }

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header solid />

      <main className="pt-[90px] pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-8">
          <nav aria-label="Administration" className="lg:w-60 flex-shrink-0">
            <div className="lg:sticky lg:top-[110px] flex lg:flex-col gap-1 lg:gap-6 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {NAV.map(section => (
                <div key={section.group} className="flex lg:flex-col gap-1">
                  <p className="hidden lg:block px-3 mb-1 font-nunito text-xs font-semibold uppercase tracking-wide text-warm-400">
                    {section.group}
                  </p>
                  {section.items.map(item => (
                    <NavLink key={item.path} item={item}
                      active={path === item.path || (item.prefix && path.startsWith(item.path + '/'))}
                      badge={item.badge ? summary?.to_review : 0} />
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
