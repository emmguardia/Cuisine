import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import RecipeCard from '../components/RecipeCard';

export default function Recettes() {
  const [selectedTag, setSelectedTag] = useState('Tous');
  const [selectedTime, setSelectedTime] = useState('Tous');

  const recipes = [
    {
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400',
      title: 'Soufflé au chocolat',
      tags: ['Dessert', 'Chocolat', 'Facile'],
      description: 'Un dessert délicieux et aérien, parfait pour impressionner vos invités. Simple à réaliser avec des ingrédients de base.',
      buttonText: 'Voir la recette',
      time: '25 min',
      difficulty: 'Facile'
    },
    {
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
      title: 'Pâtes carbonara',
      tags: ['Plat', 'Italien', 'Rapide'],
      description: 'Les pâtes carbonara authentiques, crémeuses et savoureuses. Un classique de la cuisine italienne à découvrir.',
      buttonText: 'Voir la recette',
      time: '20 min',
      difficulty: 'Moyen'
    },
    {
      image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      title: 'Salade César',
      tags: ['Salade', 'Léger', 'Rapide'],
      description: 'Une salade fraîche et croquante avec une sauce césar maison. Idéale pour un repas équilibré et savoureux.',
      buttonText: 'Voir la recette',
      time: '15 min',
      difficulty: 'Facile'
    },
    {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
      title: 'Burger maison',
      tags: ['Plat', 'Viande', 'Comfort'],
      description: 'Un burger gourmand fait maison avec des ingrédients frais. Parfait pour un repas convivial entre amis.',
      buttonText: 'Voir la recette',
      time: '30 min',
      difficulty: 'Moyen'
    },
    {
      image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',
      title: 'Tarte aux pommes',
      tags: ['Dessert', 'Fruit', 'Classique'],
      description: 'Une tarte aux pommes traditionnelle, sucrée et parfumée. Un dessert réconfortant pour toute la famille.',
      buttonText: 'Voir la recette',
      time: '45 min',
      difficulty: 'Moyen'
    },
    {
      image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400',
      title: 'Risotto aux champignons',
      tags: ['Plat', 'Végétarien', 'Italien'],
      description: 'Un risotto crémeux aux champignons, riche en saveurs. Un plat réconfortant et élégant.',
      buttonText: 'Voir la recette',
      time: '35 min',
      difficulty: 'Difficile'
    },
    {
      image: 'https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400',
      title: 'Pizza margherita',
      tags: ['Plat', 'Italien', 'Rapide'],
      description: 'La pizza classique italienne avec une pâte maison. Simple, délicieuse et toujours appréciée.',
      buttonText: 'Voir la recette',
      time: '30 min',
      difficulty: 'Moyen'
    },
    {
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
      title: 'Ratatouille',
      tags: ['Plat', 'Végétarien', 'Provençal'],
      description: 'Un plat méditerranéen aux légumes du soleil, parfumé aux herbes. Coloré et savoureux.',
      buttonText: 'Voir la recette',
      time: '40 min',
      difficulty: 'Facile'
    },
    {
      image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400',
      title: 'Tiramisu',
      tags: ['Dessert', 'Italien', 'Classique'],
      description: 'Le tiramisu traditionnel, onctueux et caféiné. Un dessert italien incontournable.',
      buttonText: 'Voir la recette',
      time: '20 min',
      difficulty: 'Moyen'
    },
    {
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
      title: 'Salade de quinoa',
      tags: ['Salade', 'Végétarien', 'Healthy'],
      description: 'Une salade complète au quinoa, légumes croquants et vinaigrette maison. Nutritive et délicieuse.',
      buttonText: 'Voir la recette',
      time: '25 min',
      difficulty: 'Facile'
    }
  ];

  const allTags = ['Tous', ...new Set(recipes.flatMap(r => r.tags))];
  const timeFilters = ['Tous', 'Rapide (< 20 min)', 'Moyen (20-30 min)', 'Long (> 30 min)'];

  const filteredRecipes = recipes.filter(recipe => {
    const tagMatch = selectedTag === 'Tous' || recipe.tags.includes(selectedTag);
    const timeMinutes = recipe.time ? parseInt(recipe.time.replace(/\D/g, '')) : 0;
    const timeMatch = selectedTime === 'Tous' || 
      (selectedTime === 'Rapide (< 20 min)' && timeMinutes < 20) ||
      (selectedTime === 'Moyen (20-30 min)' && timeMinutes >= 20 && timeMinutes <= 30) ||
      (selectedTime === 'Long (> 30 min)' && timeMinutes > 30);
    return tagMatch && timeMatch;
  });

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header />

      <main>
        <section className="relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/30 via-orange-400/20 to-pastel-peach/40 z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40 z-10" />
          <div className="absolute top-20 right-20 w-72 h-72 bg-pastel-apricot rounded-full blur-3xl opacity-30 z-20 animate-float" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-pastel-peach rounded-full blur-3xl opacity-25 z-20 animate-float" style={{ animationDelay: '1s' }} />
          <img 
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920"
            alt="Hero banner"
            className="w-full h-full object-cover animate-zoom-in"
          />
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
            <h1 className="text-4xl md:text-6xl lg:text-[80px] font-playfair font-medium italic leading-tight text-white text-center mb-8 md:mb-12 animate-fade-in-up drop-shadow-2xl" style={{textShadow: '0 8px 30px rgba(255, 140, 66, 0.5), 0 4px 15px rgba(0, 0, 0, 0.7)'}}>
              Nos Recettes
            </h1>
            
            <div className="w-full max-w-4xl space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div>
                <label className="block text-sm font-semibold text-white mb-2 drop-shadow-lg">Filtrer par catégorie</label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                        selectedTag === tag
                          ? 'bg-white/90 text-orange-600 shadow-soft-lg'
                          : 'bg-white/60 text-white hover:bg-white/80'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-white mb-2 drop-shadow-lg">Filtrer par temps</label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {timeFilters.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                        selectedTime === time
                          ? 'bg-white/90 text-orange-600 shadow-soft-lg'
                          : 'bg-white/60 text-white hover:bg-white/80'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative max-w-[1920px] mx-auto px-8 md:px-16 lg:px-24 py-12 md:py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pastel-cream/30 to-transparent -z-10" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredRecipes.map((recipe, index) => (
              <RecipeCard
                key={index}
                image={recipe.image}
                title={recipe.title}
                tags={recipe.tags}
                description={recipe.description}
                buttonText={recipe.buttonText}
                time={recipe.time}
                difficulty={recipe.difficulty}
              />
            ))}
          </div>

          {filteredRecipes.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-gray-600">Aucune recette trouvée avec ces filtres.</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
