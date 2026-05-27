import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authClient } from '../lib/auth-client';
import { api } from '../lib/api';

/* ─── Onglet Recettes ────────────────────────────────────────────────── */
function AdminRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="font-nunito text-warm-500">{recipes.length} recette{recipes.length > 1 ? 's' : ''}</p>
      </div>

      {recipes.length === 0 ? (
        <Empty message="Aucune recette publiée pour l'instant." />
      ) : (
        <div className="bg-white rounded-2xl shadow-cream overflow-hidden">
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
  );
}

/* ─── Onglet Membres ─────────────────────────────────────────────────── */
function AdminUsers({ currentUserId }) {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.admin.users()
      .then(d => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleRole = async (id, role) => {
    await api.admin.updateUserRole(id, role);
    setUsers(us => us.map(u => u.id === id ? { ...u, role } : u));
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    await api.admin.deleteUser(id);
    setUsers(us => us.filter(u => u.id !== id));
  };

  if (loading) return <TableSkeleton cols={4} />;

  return (
    <div>
      <p className="font-nunito text-warm-500 mb-6">{users.length} membre{users.length > 1 ? 's' : ''} inscrit{users.length > 1 ? 's' : ''}</p>

      {users.length === 0 ? (
        <Empty message="Aucun membre inscrit pour l'instant." />
      ) : (
        <div className="bg-white rounded-2xl shadow-cream overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-orange-50">
                {['Membre', 'Rôle', 'Inscription', ''].map(h => (
                  <th key={h} className="px-5 py-4 font-nunito text-xs font-bold uppercase tracking-wider text-warm-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-orange-50 last:border-none hover:bg-orange-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {u.image
                        ? <img src={u.image} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-100" />
                        : <span className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 text-sm font-bold flex items-center justify-center ring-2 ring-orange-100">
                            {(u.name || '?')[0].toUpperCase()}
                          </span>
                      }
                      <div>
                        <p className="font-nunito font-semibold text-warm-800 text-sm">{u.name}</p>
                        <p className="font-nunito text-xs text-warm-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-nunito text-xs text-warm-500">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.id !== currentUserId && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleRole(u.id, u.role === 'admin' ? 'membre' : 'admin')}
                          className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                          → {u.role === 'admin' ? 'Membre' : 'Admin'}
                        </button>
                        <button onClick={() => handleDelete(u.id, u.name)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                          Supprimer
                        </button>
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
  );
}

/* ─── Onglet Emails autorisés ────────────────────────────────────────── */
function AdminEmails({ currentEmail }) {
  const [emails, setEmails]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole]   = useState('membre');
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState(null);

  const load = () => {
    setLoading(true);
    api.admin.emails()
      .then(d => setEmails(d.emails || []))
      .catch(() => setEmails([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true); setError(null);
    try {
      const entry = await api.admin.addEmail({ email: newEmail.trim(), role: newRole });
      setEmails(es => [...es, entry]);
      setNewEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRole = async (id, role) => {
    await api.admin.updateEmailRole(id, role);
    setEmails(es => es.map(e => e.id === id ? { ...e, role } : e));
  };

  const handleDelete = async (id, email) => {
    if (!confirm(`Retirer ${email} de la liste ?`)) return;
    await api.admin.deleteEmail(id);
    setEmails(es => es.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* Formulaire ajout */}
      <div className="bg-white rounded-2xl shadow-cream p-6">
        <h3 className="font-playfair text-lg font-semibold text-warm-900 mb-4">Ajouter un email</h3>
        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
            placeholder="prenom.nom@email.fr"
            className="flex-1 px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800" />
          <select value={newRole} onChange={e => setNewRole(e.target.value)}
            className="px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800 bg-white">
            <option value="membre">Membre</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={adding}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-nunito font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-60 whitespace-nowrap">
            {adding ? 'Ajout…' : 'Autoriser'}
          </button>
        </form>
      </div>

      {/* Liste */}
      {loading ? <TableSkeleton cols={3} /> : emails.length === 0 ? (
        <Empty message="Aucun email dans la liste." />
      ) : (
        <div className="bg-white rounded-2xl shadow-cream overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-orange-50">
                {['Email', 'Rôle', 'Ajouté le', ''].map(h => (
                  <th key={h} className="px-5 py-4 font-nunito text-xs font-bold uppercase tracking-wider text-warm-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emails.map(e => (
                <tr key={e.id} className="border-b border-orange-50 last:border-none hover:bg-orange-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-nunito text-sm font-semibold text-warm-800">{e.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={e.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-nunito text-xs text-warm-500">
                      {new Date(e.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    {e.email.toLowerCase() !== currentEmail?.toLowerCase() && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleRole(e.id, e.role === 'admin' ? 'membre' : 'admin')}
                          className="px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                          → {e.role === 'admin' ? 'Membre' : 'Admin'}
                        </button>
                        <button onClick={() => handleDelete(e.id, e.email)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                          Retirer
                        </button>
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
  );
}

/* ─── Utilitaires UI ─────────────────────────────────────────────────── */
function RoleBadge({ role }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
      role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-warm-100 text-warm-600'
    }`}>{role}</span>
  );
}

function DiffBadge({ d }) {
  const colors = { Facile: 'text-green-700 bg-green-50', Moyen: 'text-orange-700 bg-orange-50', Difficile: 'text-red-700 bg-red-50' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[d] || 'text-warm-600 bg-warm-100'}`}>{d}</span>
  );
}

function TableSkeleton({ cols }) {
  return (
    <div className="bg-white rounded-2xl shadow-cream p-6 animate-pulse space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4">
          {[...Array(cols)].map((_, j) => (
            <div key={j} className="h-4 bg-orange-50 rounded-full flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function Empty({ message }) {
  return (
    <div className="text-center py-16">
      <p className="font-nunito text-warm-500">{message}</p>
    </div>
  );
}

/* ─── Page principale Admin ──────────────────────────────────────────── */
const TABS = [
  { id: 'recipes', label: 'Recettes',         icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'users',   label: 'Membres',           icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'emails',  label: 'Emails autorisés',  icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

export default function Admin() {
  const { data: session, isPending } = authClient.useSession();
  const [tab, setTab] = useState('recipes');

  useEffect(() => {
    if (!isPending && (!session || session.user.role !== 'admin')) {
      window.location.href = '/login';
    }
  }, [session, isPending]);

  if (isPending || !session || session.user.role !== 'admin') {
    return <div className="min-h-screen bg-cream-100" />;
  }

  const user = session.user;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-pastel-vanilla via-white to-cream-100">
      <Header solid />

      <main className="pt-[90px] pb-16">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">

          {/* En-tête */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider rounded-full">Administration</span>
            </div>
            <h1 className="font-playfair text-3xl md:text-4xl font-semibold text-warm-900">
              Tableau de bord
            </h1>
          </div>

          {/* Onglets */}
          <div className="flex gap-2 mb-8 bg-white rounded-2xl p-1.5 shadow-cream w-fit">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-nunito text-sm font-semibold transition-all duration-200 ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
                    : 'text-warm-600 hover:text-orange-600'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          {tab === 'recipes' && <AdminRecipes />}
          {tab === 'users'   && <AdminUsers currentUserId={user.id} />}
          {tab === 'emails'  && <AdminEmails currentEmail={user.email} />}
        </div>
      </main>

      <Footer />
    </div>
  );
}
