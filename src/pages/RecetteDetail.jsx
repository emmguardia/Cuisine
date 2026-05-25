import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function RecetteDetail() {
  const [recipe, setRecipe] = useState(null);
  const recipeId = new URLSearchParams(window.location.search).get('id');

  const recipes = {
    'soufflé-au-chocolat': {
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800',
      title: 'Soufflé au chocolat',
      tags: ['Dessert', 'Chocolat', 'Facile'],
      time: '25 min',
      difficulty: 'Facile',
      servings: 4,
      ingredients: [
        '200g de chocolat noir',
        '4 œufs',
        '50g de beurre',
        '50g de sucre',
        '20g de farine',
        '25cl de lait',
        '1 pincée de sel'
      ],
      steps: [
        'Préchauffer le four à 180°C. Beurrer et sucrer 4 ramequins.',
        'Faire fondre le chocolat avec le beurre au bain-marie.',
        'Séparer les blancs des jaunes d\'œufs.',
        'Mélanger les jaunes avec le sucre, puis ajouter la farine et le lait tiède.',
        'Incorporer le mélange chocolat-beurre.',
        'Monter les blancs en neige avec le sel et les incorporer délicatement.',
        'Remplir les ramequins et cuire 12-15 minutes au four.',
        'Servir immédiatement.'
      ]
    },
    'pâtes-carbonara': {
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
      title: 'Pâtes carbonara',
      tags: ['Plat', 'Italien', 'Rapide'],
      time: '20 min',
      difficulty: 'Moyen',
      servings: 4,
      ingredients: [
        '400g de pâtes',
        '200g de lardons',
        '4 œufs',
        '100g de parmesan râpé',
        'Poivre noir',
        'Sel'
      ],
      steps: [
        'Cuire les pâtes dans l\'eau bouillante salée.',
        'Pendant ce temps, faire revenir les lardons dans une poêle.',
        'Battre les œufs avec le parmesan et le poivre.',
        'Égoutter les pâtes et les mélanger avec les lardons.',
        'Hors du feu, ajouter le mélange œufs-parmesan en remuant rapidement.',
        'Servir immédiatement avec du parmesan supplémentaire.'
      ]
    },
    'salade-césar': {
      image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800',
      title: 'Salade César',
      tags: ['Salade', 'Léger', 'Rapide'],
      time: '15 min',
      difficulty: 'Facile',
      servings: 2,
      ingredients: [
        '1 salade romaine',
        '100g de parmesan',
        '2 œufs',
        'Croûtons',
        'Anchois',
        'Huile d\'olive',
        'Jus de citron'
      ],
      steps: [
        'Laver et couper la salade romaine.',
        'Préparer la sauce césar avec les anchois, l\'huile et le citron.',
        'Faire cuire les œufs mollets.',
        'Mélanger la salade avec la sauce.',
        'Ajouter le parmesan et les croûtons.',
        'Servir avec les œufs mollets.'
      ]
    },
    'burger-maison': {
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
      title: 'Burger maison',
      tags: ['Plat', 'Viande', 'Comfort'],
      time: '30 min',
      difficulty: 'Moyen',
      servings: 4,
      ingredients: [
        '500g de bœuf haché',
        '4 pains à burger',
        'Fromage',
        'Laitue',
        'Tomates',
        'Oignons',
        'Cornichons'
      ],
      steps: [
        'Former 4 steaks avec le bœuf haché.',
        'Cuire les steaks à la poêle.',
        'Griller les pains à burger.',
        'Assembler le burger avec tous les ingrédients.',
        'Servir chaud avec des frites.'
      ]
    }
  };

  useEffect(() => {
    const normalizedId = recipeId ? decodeURIComponent(recipeId).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-') : 'soufflé-au-chocolat';
    const foundRecipe = recipes[normalizedId] || recipes['soufflé-au-chocolat'];
    setRecipe(foundRecipe);
  }, [recipeId]);

  if (!recipe) return null;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-pastel-vanilla via-white to-pastel-cream">
      <Header solid />
      
      <main className="pt-[100px]">
        <section className="relative max-w-[1920px] mx-auto px-8 md:px-16 lg:px-24 py-12 md:py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pastel-cream/30 to-transparent -z-10" />
          
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <a href="/recettes" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour aux recettes
              </a>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
              <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden group">
                <img 
                  src={recipe.image} 
                  alt={recipe.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>

              <div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {recipe.tags.map((tag, index) => (
                    <span key={index} className="px-4 py-2 bg-pastel-peach/50 rounded-full text-sm font-medium text-orange-700">
                      {tag}
                    </span>
                  ))}
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                  {recipe.title}
                </h1>

                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="flex items-center gap-2 px-4 py-2 bg-pastel-peach/50 rounded-full">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-orange-700 font-medium">{recipe.time}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-pastel-apricot/50 rounded-full">
                    <span className="text-orange-700 font-medium">{recipe.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-pastel-cream/50 rounded-full">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-orange-700 font-medium">{recipe.servings} portions</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-soft">
                <h2 className="text-2xl md:text-3xl font-semibold mb-6 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                  Ingrédients
                </h2>
                <ul className="space-y-3">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-soft">
                <h2 className="text-2xl md:text-3xl font-semibold mb-6 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                  Préparation
                </h2>
                <ol className="space-y-4">
                  {recipe.steps.map((step, index) => (
                    <li key={index} className="flex gap-4">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}


