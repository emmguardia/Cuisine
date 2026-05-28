import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authClient } from '../lib/auth-client';
import { api, uploadToR2 } from '../lib/api';

/* ─── Constantes ─────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  title: '', description: '', image_url: '',
  tags: '', time: '', difficulty: 'Moyen', servings: 4,
  ingredients: [''], steps: [''],
};
const DRAFT_KEY = 'recipe-draft-new';

/* ─── Lecture du brouillon au démarrage ───────────────────────────────── */
function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // Draft valide seulement s'il a du contenu réel
    if (d.title || d.description || d.ingredients?.some(Boolean) || d.steps?.some(Boolean)) return d;
  } catch {}
  return null;
}

/* ─── Formulaire recette ─────────────────────────────────────────────── */
function RecipeModal({ recipe, onClose, onSaved }) {
  const isNew = !recipe?.id;

  /* Initialisation : draft localStorage pour nouvelles recettes */
  const [form, setForm] = useState(() => {
    if (recipe) {
      return {
        ...recipe,
        tags: Array.isArray(recipe.tags) ? recipe.tags.join(', ') : recipe.tags || '',
      };
    }
    return readDraft() ?? EMPTY_FORM;
  });

  const [draftRestored]              = useState(() => isNew && readDraft() !== null);
  const [showDraftBanner, setShowDraftBanner] = useState(true);
  const [draftStatus,  setDraftStatus]  = useState(''); // '' | 'saved'
  const [uploading,    setUploading]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  const fileRef        = useRef();
  const draftTimer     = useRef(null);
  const feedbackTimer  = useRef(null);

  /* ── Auto-save localStorage (debounce 600 ms, nouvelles recettes seules) */
  useEffect(() => {
    if (!isNew) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setDraftStatus('saved');
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setDraftStatus(''), 2000);
      } catch {}
    }, 600);
    return () => clearTimeout(draftTimer.current);
  }, [form, isNew]);

  /* ── Nettoyage sur démontage */
  useEffect(() => () => {
    clearTimeout(draftTimer.current);
    clearTimeout(feedbackTimer.current);
  }, []);

  /* ── Handlers stables (useCallback → évite re-render des champs) */
  const set = useCallback((key, val) =>
    setForm(f => ({ ...f, [key]: val })), []);

  const setList = useCallback((key, i, val) =>
    setForm(f => ({ ...f, [key]: f[key].map((v, idx) => idx === i ? val : v) })), []);

  const addItem = useCallback(key =>
    setForm(f => ({ ...f, [key]: [...f[key], ''] })), []);

  const removeItem = useCallback((key, i) =>
    setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) })), []);

  const handleImage = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const url = await uploadToR2(file);
      set('image_url', url);
    } catch (err) {
      setError('Upload impossible : ' + err.message);
    } finally {
      setUploading(false);
    }
  }, [set]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setForm(EMPTY_FORM);
    setShowDraftBanner(false);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est requis'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
        servings:    Number(form.servings) || 4,
        ingredients: form.ingredients.filter(Boolean),
        steps:       form.steps.filter(Boolean),
      };
      if (recipe?.id) {
        await api.recipes.update(recipe.id, payload);
      } else {
        await api.recipes.create(payload);
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, recipe?.id, onSaved]);

  /* ─── Rendu ──────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-8">

        {/* En-tête modal */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-orange-100">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-playfair text-2xl font-semibold text-warm-900 truncate">
              {recipe ? 'Modifier la recette' : 'Nouvelle recette'}
            </h2>
            {draftStatus === 'saved' && (
              <span className="flex-shrink-0 text-xs font-semibold text-green-500 font-nunito">
                ✓ Sauvegardé
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center hover:bg-orange-100 transition-colors ml-3">
            <svg className="w-5 h-5 text-warm-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">

          {/* Bannière brouillon restauré */}
          {draftRestored && showDraftBanner && (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl gap-3">
              <p className="font-nunito text-sm text-blue-700">
                ✦ Brouillon récupéré — vos saisies précédentes ont été restaurées.
              </p>
              <button type="button" onClick={clearDraft}
                className="flex-shrink-0 text-xs font-semibold text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors">
                Effacer
              </button>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Titre *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800"
              placeholder="Tarte aux pommes…" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Description courte</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800 resize-none"
              placeholder="Un dessert réconfortant…" />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Photo</label>
            <div className="flex gap-3 items-start">
              {form.image_url && (
                <img src={form.image_url} alt="" className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <input type="file" ref={fileRef} accept="image/*" onChange={handleImage} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-orange-200 rounded-xl text-sm font-semibold text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50">
                  {uploading ? 'Upload en cours…' : 'Choisir une image'}
                </button>
                <input value={form.image_url} onChange={e => set('image_url', e.target.value)}
                  className="w-full px-3 py-2 border border-orange-100 rounded-lg text-xs font-nunito text-warm-600 focus:outline-none focus:border-orange-300"
                  placeholder="Ou coller une URL directement" />
              </div>
            </div>
          </div>

          {/* Méta : tags / temps / difficulté / portions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">
                Tags <span className="text-warm-400 font-normal">(virgules)</span>
              </label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800"
                placeholder="Dessert, Chocolat" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">Temps</label>
              <input value={form.time} onChange={e => set('time', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800"
                placeholder="45 min" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">Difficulté</label>
              <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800 bg-white">
                <option>Facile</option>
                <option>Moyen</option>
                <option>Difficile</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">Portions</label>
              <input type="number" min="1" max="50" value={form.servings} onChange={e => set('servings', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-warm-800" />
            </div>
          </div>

          {/* Ingrédients */}
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">Ingrédients</label>
            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input value={ing} onChange={e => setList('ingredients', i, e.target.value)}
                    className="flex-1 px-3 py-2 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-sm text-warm-800"
                    placeholder={`Ingrédient ${i + 1}`} />
                  <button type="button" onClick={() => removeItem('ingredients', i)}
                    className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addItem('ingredients')}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1.5 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un ingrédient
              </button>
            </div>
          </div>

          {/* Étapes */}
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">Étapes</label>
            <div className="space-y-2">
              {form.steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-2.5">
                    {i + 1}
                  </span>
                  <textarea value={step} onChange={e => setList('steps', i, e.target.value)} rows={2}
                    className="flex-1 px-3 py-2 border-2 border-orange-100 rounded-xl focus:outline-none focus:border-orange-300 font-nunito text-sm text-warm-800 resize-none"
                    placeholder={`Étape ${i + 1}…`} />
                  <button type="button" onClick={() => removeItem('steps', i)}
                    className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center flex-shrink-0 mt-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addItem('steps')}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1.5 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter une étape
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border-2 border-orange-200 rounded-xl font-nunito font-semibold text-warm-700 hover:bg-orange-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-nunito font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-60">
              {saving ? 'Enregistrement…' : recipe ? 'Modifier' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Carte recette (dashboard) ──────────────────────────────────────── */
function DashCard({ recipe, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Supprimer "${recipe.title}" ?`)) return;
    setDeleting(true);
    try { await onDelete(recipe.id); } finally { setDeleting(false); }
  }, [recipe.id, recipe.title, onDelete]);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-cream group">
      <div className="relative h-40 bg-orange-50">
        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy" decoding="async" />
        )}
        {recipe.time && (
          <div className="absolute top-2 right-2 bg-white/95 px-2 py-0.5 rounded-full text-xs font-semibold text-orange-600">
            {recipe.time}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-playfair text-base font-semibold text-warm-900 leading-snug mb-2 line-clamp-2">
          {recipe.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {(recipe.tags || []).slice(0, 2).map(t => (
            <span key={t} className="px-2 py-0.5 bg-orange-50 rounded-full text-xs font-semibold text-orange-600">{t}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(recipe)}
            className="flex-1 py-2 text-sm font-semibold text-orange-600 border-2 border-orange-200 rounded-xl hover:bg-orange-50 transition-colors">
            Modifier
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 py-2 text-sm font-semibold text-red-500 border-2 border-red-100 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
            {deleting ? '…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: session, isPending } = authClient.useSession();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'new' | recipe object

  useEffect(() => {
    if (!isPending && !session) window.location.href = '/login';
  }, [session, isPending]);

  const loadRecipes = useCallback(() => {
    setLoading(true);
    api.recipes.mine()
      .then(d => setRecipes(d.recipes || []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (session) loadRecipes(); }, [session, loadRecipes]);

  const handleDelete = useCallback(async (id) => {
    await api.recipes.delete(id);
    setRecipes(rs => rs.filter(r => r.id !== id));
  }, []);

  const handleSaved = useCallback(() => { setModal(null); loadRecipes(); }, [loadRecipes]);

  const openNew  = useCallback(() => setModal('new'), []);
  const closeModal = useCallback(() => setModal(null), []);

  if (isPending || !session) return <div className="min-h-screen bg-cream-100" />;

  const user = session.user;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-pastel-vanilla via-white to-cream-100">
      <Header solid />

      <main className="pt-[90px] pb-16">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">

          {/* En-tête */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
            <div>
              <h1 className="font-playfair text-3xl md:text-4xl font-semibold text-warm-900">
                Mes recettes
              </h1>
              <p className="font-nunito text-warm-500 mt-1">
                {recipes.length === 0
                  ? "Aucune recette publiée pour l'instant"
                  : `${recipes.length} recette${recipes.length > 1 ? 's' : ''} publiée${recipes.length > 1 ? 's' : ''}`}
              </p>
            </div>
            <button onClick={openNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-nunito font-bold rounded-full shadow-[0_4px_16px_rgba(255,140,66,0.4)] hover:from-orange-600 hover:to-orange-700 transition-all hover:-translate-y-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Ajouter une recette
            </button>
          </div>

          {/* Grille */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-cream animate-pulse">
                  <div className="h-40 bg-orange-50" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-orange-50 rounded-full w-3/4" />
                    <div className="h-3 bg-orange-50 rounded-full w-1/2" />
                    <div className="h-9 bg-orange-50 rounded-xl mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-3xl bg-orange-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="font-playfair text-2xl text-warm-700 mb-2">Aucune recette pour l'instant</p>
              <p className="font-nunito text-warm-500 mb-6">Partagez vos créations culinaires avec les membres de l'association !</p>
              <button onClick={openNew}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-nunito font-bold rounded-full transition-all hover:-translate-y-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Publier ma première recette
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {recipes.map(r => (
                <DashCard key={r.id} recipe={r}
                  onEdit={setModal}
                  onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </main>

      {modal && (
        <RecipeModal
          recipe={modal === 'new' ? null : modal}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      <Footer />
    </div>
  );
}
