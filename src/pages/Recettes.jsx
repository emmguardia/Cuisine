import { useState, useMemo } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import RecipeCard from '../components/RecipeCard';

const recipes = [
  {
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&q=75',
    title: 'Soufflé au chocolat',
    tags: ['Dessert', 'Chocolat', 'Facile'],
    description: 'Un dessert délicieux et aérien, parfait pour impressionner vos invités. Simple à réaliser avec des ingrédients de base.',
    time: '25 min',
    difficulty: 'Facile'
  },
  {
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&q=75',
    title: 'Pâtes carbonara',
    tags: ['Plat', 'Italien', 'Rapide'],
    description: 'Les pâtes carbonara authentiques, crémeuses et savoureuses. Un classique de la cuisine italienne à découvrir.',
    time: '20 min',
    difficulty: 'Moyen'
  },
  {
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&auto=format&q=75',
    title: 'Salade César',
    tags: ['Salade', 'Léger', 'Rapide'],
    description: 'Une salade fraîche et croquante avec une sauce césar maison. Idéale pour un repas équilibré et savoureux.',
    time: '15 min',
    difficulty: 'Facile'
  },
  {
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&q=75',
    title: 'Burger maison',
    tags: ['Plat', 'Viande', 'Comfort'],
    description: 'Un burger gourmand fait maison avec des ingrédients frais. Parfait pour un repas convivial entre amis.',
    time: '30 min',
    difficulty: 'Moyen'
  },
  {
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&q=75',
    title: 'Tarte aux pommes',
    tags: ['Dessert', 'Fruit', 'Classique'],
    description: 'Une tarte aux pommes traditionnelle, sucrée et parfumée. Un dessert réconfortant pour toute la famille.',
    time: '45 min',
    difficulty: 'Moyen'
  },
  {
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600&auto=format&q=75',
    title: 'Risotto aux champignons',
    tags: ['Plat', 'Végétarien', 'Italien'],
    description: 'Un risotto crémeux aux champignons, riche en saveurs. Un plat réconfortant et élégant.',
    time: '35 min',
    difficulty: 'Difficile'
  },
  {
    image: 'https://images.unsplash.com/photo-1551782450-17144efb9c50?w=600&auto=format&q=75',
    title: 'Pizza margherita',
    tags: ['Plat', 'Italien', 'Rapide'],
    description: 'La pizza classique italienne avec une pâte maison. Simple, délicieuse et toujours appréciée.',
    time: '30 min',
    difficulty: 'Moyen'
  },
  {
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&q=75',
    title: 'Ratatouille',
    tags: ['Plat', 'Végétarien', 'Provençal'],
    description: 'Un plat méditerranéen aux légumes du soleil, parfumé aux herbes. Coloré et savoureux.',
    time: '40 min',
    difficulty: 'Facile'
  },
  {
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&auto=format&q=75',
    title: 'Tiramisu',
    tags: ['Dessert', 'Italien', 'Classique'],
    description: 'Le tiramisu traditionnel, onctueux et caféiné. Un dessert italien incontournable.',
    time: '20 min',
    difficulty: 'Moyen'
  },
  {
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&q=75',
    title: 'Salade de quinoa',
    tags: ['Salade', 'Végétarien', 'Healthy'],
    description: 'Une salade complète au quinoa, légumes croquants et vinaigrette maison. Nutritive et délicieuse.',
    time: '25 min',
    difficulty: 'Facile'
  }
];

const timeFilters = ['Tous', 'Rapide (< 20 min)', 'Moyen (20-30 min)', 'Long (> 30 min)'];

export default function Recettes() {
  const [selectedTag, setSelectedTag] = useState('Tous');
  const [selectedTime, setSelectedTime] = useState('Tous');

  const allTags = useMemo(
    () => ['Tous', ...new Set(recipes.flatMap(r => r.tags))],
    []
  );

  const filteredRecipes = useMemo(() => recipes.filter(recipe => {
    const tagMatch = selectedTag === 'Tous' || recipe.tags.includes(selectedTag);
    const mins = parseInt(recipe.time);
    const timeMatch =
      selectedTime === 'Tous' ||
      (selectedTime === 'Rapide (< 20 min)'   && mins < 20) ||
      (selectedTime === 'Moyen (20-30 min)'   && mins >= 20 && mins <= 30) ||
      (selectedTime === 'Long (> 30 min)'     && mins > 30);
    return tagMatch && timeMatch;
  }), [selectedTag, selectedTime]);

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

            <div className="w-full max-w-3xl space-y-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`font-nunito px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      selectedTag === tag
                        ? 'bg-white text-orange-600'
                        : 'bg-white/25 text-white hover:bg-white/40'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {timeFilters.map(time => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`font-nunito px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      selectedTime === time
                        ? 'bg-white text-orange-600'
                        : 'bg-white/25 text-white hover:bg-white/40'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Grille */}
        <section className="max-w-7xl mx-auto px-6 md:px-10 py-14">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-nunito text-lg text-warm-500">Aucune recette trouvée avec ces filtres.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRecipes.map((recipe, index) => (
                <RecipeCard key={recipe.title} recipe={recipe} priority={index < 4} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
