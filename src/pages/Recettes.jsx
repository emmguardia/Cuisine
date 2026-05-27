import { useState, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import RecipeCard from '../components/RecipeCard';
import { api } from '../lib/api';

const timeFilters = ['Tous', 'Rapide (< 20 min)', 'Moyen (20-30 min)', 'Long (> 30 min)'];

export default function Recettes() {
  const [recipes, setRecipes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedTag, setSelectedTag] = useState('Tous');
  const [selectedTime, setSelectedTime] = useState('Tous');

  useEffect(() => {
    api.recipes.list()
      .then(data => setRecipes(data.recipes || []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(
    () => ['Tous', ...new Set(recipes.flatMap(r => r.tags || []))],
    [recipes]
  );

  const filtered = useMemo(() => recipes.filter(r => {
    const tagMatch  = selectedTag === 'Tous' || (r.tags || []).includes(selectedTag);
    const mins      = parseInt(r.time) || 0;
    const timeMatch =
      selectedTime === 'Tous' ||
      (selectedTime === 'Rapide (< 20 min)'  && mins < 20) ||
      (selectedTime === 'Moyen (20-30 min)'  && mins >= 20 && mins <= 30) ||
      (selectedTime === 'Long (> 30 min)'    && mins > 30);
    return tagMatch && timeMatch;
  }), [recipes, selectedTag, selectedTime]);

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header />

      <main>
        {/* Hero */}
        <section className="relative w-full h-[480px] md:h-[560px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50 z-10" />
          <img
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&auto=format&q=75"
            alt="Nos recettes"
            className="w-full h-full object-cover"
            fetchpriority="high"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4">
            <h1 className="font-playfair text-4xl md:text-6xl font-semibold italic text-white text-center mb-8 drop-shadow-lg">
              Nos Recettes
            </h1>

            {!loading && recipes.length > 0 && (
              <div className="w-full max-w-3xl space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => setSelectedTag(tag)}
                      className={`font-nunito px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                        selectedTag === tag ? 'bg-white text-orange-600' : 'bg-white/25 text-white hover:bg-white/40'
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {timeFilters.map(t => (
                    <button key={t} onClick={() => setSelectedTime(t)}
                      className={`font-nunito px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                        selectedTime === t ? 'bg-white text-orange-600' : 'bg-white/25 text-white hover:bg-white/40'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Grille */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 py-14">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-cream animate-pulse">
                  <div className="h-48 bg-orange-50" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-orange-50 rounded-full w-3/4" />
                    <div className="h-3 bg-orange-50 rounded-full w-1/2" />
                    <div className="h-3 bg-orange-50 rounded-full" />
                    <div className="h-3 bg-orange-50 rounded-full w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="font-playfair text-2xl text-warm-700 mb-2">Aucune recette pour l'instant</p>
              <p className="font-nunito text-warm-500">Les membres de l'association partagent bientôt leurs créations !</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-nunito text-lg text-warm-500">Aucune recette avec ces filtres.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((recipe, i) => (
                <RecipeCard key={recipe.id} recipe={recipe} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
