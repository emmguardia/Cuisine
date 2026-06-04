import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../lib/api';

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative w-full h-screen min-h-[640px] overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1400&auto=format&q=75"
        alt="Cuisine étudiante"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        fetchpriority="high"
        decoding="sync"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/60" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <span className="font-nunito text-sm font-semibold tracking-[0.2em] uppercase text-orange-300 mb-6 animate-fade-in">
          Guardia Cybersecurity School · Quest Education
        </span>
        <h1
          className="font-playfair text-5xl md:text-7xl lg:text-[88px] font-semibold italic text-white leading-[1.1] mb-6 animate-fade-in-up"
          style={{ textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          La bonne cuisine,
          <br />
          <span className="text-orange-300">pour vos événements</span>
        </h1>
        <p className="font-nunito text-lg md:text-xl text-white/80 max-w-2xl mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          Des plats faits maison, accessibles à tous les étudiants — chaque semaine et lors de vos événements.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <a
            href="/contact"
            className="font-nunito font-bold text-[15px] px-8 py-3.5 rounded-full bg-orange-500 text-white shadow-[0_4px_20px_rgba(255,140,66,0.5)] hover:bg-orange-600 hover:shadow-[0_6px_28px_rgba(255,140,66,0.6)] transition-all duration-300 hover:-translate-y-0.5"
          >
            Contacter le club
          </a>
          <a
            href="/recettes"
            className="font-nunito font-semibold text-[15px] px-8 py-3.5 rounded-full border-2 border-white/60 text-white hover:bg-white/15 hover:border-white transition-all duration-300"
          >
            Voir nos recettes
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-float">
        <span className="font-nunito text-xs text-white/50 tracking-widest uppercase">Découvrir</span>
        <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

/* ── Mission ──────────────────────────────────────────────────────── */
function Mission() {
  return (
    <section className="py-24 px-6 bg-cream-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1">
            <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">
              Qui sommes-nous
            </span>
            <h2 className="font-playfair text-4xl md:text-5xl font-semibold text-warm-900 leading-tight mb-6">
              Manger bien,<br />
              <span className="italic text-orange-500">sans se ruiner</span>
            </h2>
            <p className="font-nunito text-lg text-warm-600 leading-relaxed mb-5">
              Club Quisine est l'association culinaire de la <strong className="text-warm-800">Guardia Cybersecurity School</strong>, fondée au sein du groupe <strong className="text-warm-800">Quest Education</strong>.
            </p>
            <p className="font-nunito text-lg text-warm-600 leading-relaxed mb-5">
              Chaque semaine, on prépare des plats faits maison proposés aux étudiants à des tarifs très accessibles. On intervient aussi lors des événements de l'école pour régaler tout le monde.
            </p>
            <p className="font-nunito text-lg text-warm-600 leading-relaxed">
              Notre conviction : un bon repas ne doit pas être un luxe, même quand on est étudiant.
            </p>
          </div>

          <div className="flex-1 relative">
            <div className="rounded-3xl overflow-hidden shadow-warm-lg aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&q=75"
                alt="Cuisine en action"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-warm p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
              </div>
              <div>
                <div className="font-playfair font-semibold text-warm-900">Chaque semaine</div>
                <div className="font-nunito text-sm text-warm-600">Nouveaux plats préparés</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Ce qu'on fait ────────────────────────────────────────────────── */
function WhatWeDo() {
  const items = [
    {
      title: 'Repas hebdomadaires',
      desc: 'Chaque semaine, notre équipe cuisine des plats faits maison et les propose aux étudiants à des prix accessibles.',
      img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&q=75',
    },
    {
      title: 'Événements & soirées',
      desc: 'Vous organisez un événement et cherchez une restauration de qualité ? On intervient pour régaler vos convives.',
      img: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&q=75',
    },
    {
      title: 'Cuisine accessible',
      desc: 'Qualité et accessibilité ne sont pas incompatibles. On prouve que la bonne cuisine est à la portée de tous.',
      img: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&auto=format&q=75',
    },
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">
            Ce qu'on fait
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl font-semibold text-warm-900 italic">
            Du fait maison,<br />pour chaque occasion
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <div key={i} className="group bg-cream-100 rounded-2xl overflow-hidden hover:shadow-warm transition-all duration-300 hover:-translate-y-1">
              <div className="h-48 overflow-hidden">
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-7">
                <h3 className="font-playfair text-xl font-semibold text-warm-900 mb-3">{item.title}</h3>
                <p className="font-nunito text-warm-600 leading-relaxed text-[15px]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Guardia ──────────────────────────────────────────────────────── */
function Guardia() {
  return (
    <section className="py-24 px-6 bg-warm-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-orange-500/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-orange-300/5 blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-400 mb-6 block">
          Nos racines
        </span>
        <h2 className="font-playfair text-4xl md:text-5xl font-semibold text-white italic leading-tight mb-6">
          Né à Guardia,<br />ouvert à tous
        </h2>
        <p className="font-nunito text-lg text-white/65 leading-relaxed max-w-2xl mx-auto mb-10">
          Club Quisine est fondé à la <strong className="text-white">Guardia Cybersecurity School</strong>, école du groupe <strong className="text-white">Quest Education</strong>. L'asso est portée par des étudiants passionnés. Vous cherchez une équipe pour cuisiner lors de votre prochain événement ? Parlons-en.
        </p>
        <a
          href="/contact"
          className="inline-block font-nunito font-bold text-[15px] px-8 py-3.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(255,140,66,0.4)]"
        >
          Contacter le club
        </a>
      </div>
    </section>
  );
}

/* ── Recettes (aperçu) — les 3 dernières recettes publiées ────────── */
function RecettesApercu() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.recipes.list()
      .then(d => setRecipes((d.recipes || []).slice(0, 3)))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false));
  }, []);

  // Pas de section vide : si aucune recette une fois le chargement terminé, on n'affiche rien
  if (!loading && recipes.length === 0) return null;

  return (
    <section className="py-24 px-6 bg-cream-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">
              Un avant-goût
            </span>
            <h2 className="font-playfair text-4xl font-semibold text-warm-900 italic">
              Quelques-unes<br />de nos recettes
            </h2>
          </div>
          <a href="/recettes" className="font-nunito font-bold text-[14px] px-6 py-3 rounded-full border-2 border-orange-400 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all duration-300 self-start md:self-auto whitespace-nowrap">
            Voir toutes les recettes →
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {loading
            ? [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-cream animate-pulse">
                  <div className="h-52 bg-orange-50" />
                  <div className="p-5"><div className="h-5 bg-orange-50 rounded-full w-2/3" /></div>
                </div>
              ))
            : recipes.map((r) => (
                <a key={r.id} href={`/recette?id=${r.id}`}
                  className="group block bg-white rounded-2xl overflow-hidden shadow-cream hover:shadow-warm transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-52 overflow-hidden bg-orange-50">
                    {r.image_url && (
                      <img src={r.image_url} alt={r.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                    )}
                    {r.time && (
                      <div className="absolute top-3 right-3 bg-white/95 text-orange-600 font-nunito text-xs font-bold px-3 py-1 rounded-full">
                        {r.time}
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex items-center justify-between gap-2">
                    <h3 className="font-playfair text-lg font-semibold text-warm-900 line-clamp-1">{r.title}</h3>
                    {(r.difficulty || (r.tags && r.tags[0])) && (
                      <span className="font-nunito text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">
                        {r.difficulty || r.tags[0]}
                      </span>
                    )}
                  </div>
                </a>
              ))}
        </div>
      </div>
    </section>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <div className="w-full">
      <Header />
      <Hero />
      <Mission />
      <WhatWeDo />
      <Guardia />
      <RecettesApercu />
      <Footer />
    </div>
  );
}
