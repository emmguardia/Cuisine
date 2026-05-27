import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../lib/api';

export default function RecetteDetail() {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const id = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!id) { setError('Recette introuvable'); setLoading(false); return; }
    api.recipes.get(id)
      .then(setRecipe)
      .catch(() => setError('Recette introuvable'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-cream-100">
        <Header solid />
        <main className="pt-[90px]">
          <div className="max-w-6xl mx-auto px-6 py-12 animate-pulse space-y-6">
            <div className="h-6 w-32 bg-orange-50 rounded-full" />
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="h-[360px] bg-orange-50 rounded-3xl" />
              <div className="space-y-4 flex flex-col justify-center">
                <div className="flex gap-2">
                  {[1,2,3].map(i => <div key={i} className="h-6 w-16 bg-orange-50 rounded-full" />)}
                </div>
                <div className="h-10 bg-orange-50 rounded-xl w-3/4" />
                <div className="flex gap-3">
                  {[1,2,3].map(i => <div key={i} className="h-9 w-24 bg-orange-50 rounded-full" />)}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="w-full min-h-screen bg-cream-100">
        <Header solid />
        <main className="pt-[90px]">
          <div className="max-w-6xl mx-auto px-6 py-24 text-center">
            <p className="font-playfair text-3xl text-warm-700 mb-4">Recette introuvable</p>
            <a href="/recettes" className="btn-primary inline-block">Voir toutes les recettes</a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header solid />

      <main className="pt-[90px]">
        <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">

          <div className="mb-8">
            <a href="/recettes" className="inline-flex items-center gap-2 font-nunito text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour aux recettes
            </a>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-10">
            <div className="relative h-[360px] md:h-[460px] rounded-3xl overflow-hidden bg-orange-50">
              {recipe.image_url && (
                <img src={recipe.image_url} alt={recipe.title}
                  className="w-full h-full object-cover"
                  loading="eager" fetchpriority="high" decoding="sync" />
              )}
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2 mb-5">
                {(recipe.tags || []).map(tag => (
                  <span key={tag} className="font-nunito px-3 py-1 bg-orange-50 rounded-full text-sm font-semibold text-orange-600">{tag}</span>
                ))}
              </div>

              <h1 className="font-playfair text-4xl md:text-5xl font-semibold text-warm-900 leading-tight mb-3">
                {recipe.title}
              </h1>

              {recipe.author_name && (
                <p className="font-nunito text-sm text-warm-500 mb-6">
                  Par <span className="font-semibold text-warm-700">{recipe.author_name}</span>
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                {recipe.time && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-cream">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.time}</span>
                  </div>
                )}
                {recipe.difficulty && (
                  <div className="px-4 py-2 bg-white rounded-full shadow-cream">
                    <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.difficulty}</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-cream">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.servings} portions</span>
                  </div>
                )}
              </div>

              {recipe.description && (
                <p className="font-nunito text-warm-600 mt-6 leading-relaxed">{recipe.description}</p>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {(recipe.ingredients || []).length > 0 && (
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-cream">
                <h2 className="font-playfair text-2xl font-semibold text-warm-900 mb-6">Ingrédients</h2>
                <ul className="space-y-3">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                      <span className="font-nunito text-warm-600">{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(recipe.steps || []).length > 0 && (
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-cream">
                <h2 className="font-playfair text-2xl font-semibold text-warm-900 mb-6">Préparation</h2>
                <ol className="space-y-4">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white font-nunito text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-nunito text-warm-600 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
