import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const recipes = {
  'soufflé-au-chocolat': {
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=900&auto=format&q=75',
    title: 'Soufflé au chocolat',
    tags: ['Dessert', 'Chocolat', 'Facile'],
    time: '25 min', difficulty: 'Facile', servings: 4,
    ingredients: ['200g de chocolat noir','4 œufs','50g de beurre','50g de sucre','20g de farine','25cl de lait','1 pincée de sel'],
    steps: ['Préchauffer le four à 180°C. Beurrer et sucrer 4 ramequins.','Faire fondre le chocolat avec le beurre au bain-marie.','Séparer les blancs des jaunes d\'œufs.','Mélanger les jaunes avec le sucre, puis ajouter la farine et le lait tiède.','Incorporer le mélange chocolat-beurre.','Monter les blancs en neige avec le sel et les incorporer délicatement.','Remplir les ramequins et cuire 12-15 minutes au four.','Servir immédiatement.']
  },
  'pâtes-carbonara': {
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&auto=format&q=75',
    title: 'Pâtes carbonara',
    tags: ['Plat', 'Italien', 'Rapide'],
    time: '20 min', difficulty: 'Moyen', servings: 4,
    ingredients: ['400g de pâtes','200g de lardons','4 œufs','100g de parmesan râpé','Poivre noir','Sel'],
    steps: ['Cuire les pâtes dans l\'eau bouillante salée.','Pendant ce temps, faire revenir les lardons dans une poêle.','Battre les œufs avec le parmesan et le poivre.','Égoutter les pâtes et les mélanger avec les lardons.','Hors du feu, ajouter le mélange œufs-parmesan en remuant rapidement.','Servir immédiatement avec du parmesan supplémentaire.']
  },
  'salade-césar': {
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&auto=format&q=75',
    title: 'Salade César',
    tags: ['Salade', 'Léger', 'Rapide'],
    time: '15 min', difficulty: 'Facile', servings: 2,
    ingredients: ['1 salade romaine','100g de parmesan','2 œufs','Croûtons','Anchois','Huile d\'olive','Jus de citron'],
    steps: ['Laver et couper la salade romaine.','Préparer la sauce césar avec les anchois, l\'huile et le citron.','Faire cuire les œufs mollets.','Mélanger la salade avec la sauce.','Ajouter le parmesan et les croûtons.','Servir avec les œufs mollets.']
  },
  'burger-maison': {
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&auto=format&q=75',
    title: 'Burger maison',
    tags: ['Plat', 'Viande', 'Comfort'],
    time: '30 min', difficulty: 'Moyen', servings: 4,
    ingredients: ['500g de bœuf haché','4 pains à burger','Fromage','Laitue','Tomates','Oignons','Cornichons'],
    steps: ['Former 4 steaks avec le bœuf haché.','Cuire les steaks à la poêle.','Griller les pains à burger.','Assembler le burger avec tous les ingrédients.','Servir chaud avec des frites.']
  }
};

export default function RecetteDetail() {
  const [recipe, setRecipe] = useState(null);
  const recipeId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    const id = recipeId
      ? decodeURIComponent(recipeId).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
      : 'soufflé-au-chocolat';
    setRecipe(recipes[id] || recipes['soufflé-au-chocolat']);
  }, [recipeId]);

  if (!recipe) return null;

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
            <div className="relative h-[360px] md:h-[460px] rounded-3xl overflow-hidden">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-full object-cover"
                loading="eager"
                fetchpriority="high"
                decoding="sync"
              />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2 mb-5">
                {recipe.tags.map((tag) => (
                  <span key={tag} className="font-nunito px-3 py-1 bg-orange-50 rounded-full text-sm font-semibold text-orange-600">
                    {tag}
                  </span>
                ))}
              </div>

              <h1 className="font-playfair text-4xl md:text-5xl font-semibold text-warm-900 leading-tight mb-6">
                {recipe.title}
              </h1>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-cream">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.time}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-cream">
                  <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.difficulty}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-cream">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-nunito text-sm font-semibold text-warm-700">{recipe.servings} portions</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-cream">
              <h2 className="font-playfair text-2xl font-semibold text-warm-900 mb-6">Ingrédients</h2>
              <ul className="space-y-3">
                {recipe.ingredients.map((ingredient, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                    <span className="font-nunito text-warm-600">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

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
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
