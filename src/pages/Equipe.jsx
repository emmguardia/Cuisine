import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../lib/api';

const bureau = [
  {
    name: 'Damien Dathueyt',
    role: 'Président',
    initials: 'DD',
    color: 'from-orange-400 to-orange-600',
    photo: '/images/damien.webp',
    desc: 'Fondateur du club, Damien pilote le projet avec passion. Il veille à ce que chaque repas soit à la hauteur des ambitions de l\'asso et coordonne l\'ensemble des activités du Club Quisine au sein de Guardia Cybersecurity School.',
  },
  {
    name: 'Quianne Quirino',
    role: 'Vice-présidente',
    initials: 'QQ',
    color: 'from-amber-400 to-orange-500',
    photo: '/images/quianne.webp',
    desc: 'Quianne assure la coordination de l\'équipe au quotidien et est le moteur principal dans l\'organisation des événements culinaires. Elle fait le lien entre les membres du bureau et les équipes sur le terrain.',
  },
  {
    name: 'Enzo Monnet-Mata',
    role: 'Trésorier',
    initials: 'EM',
    color: 'from-orange-500 to-red-400',
    photo: '/images/enzo.webp',
    desc: 'Enzo gère les finances de l\'association avec rigueur pour garantir que chaque plat reste accessible à tous les étudiants. Il veille à l\'équilibre budgétaire tout en maintenant la qualité des repas proposés. Il est également l\'artisan du site web du club.',
  },
  {
    name: 'Raphaël Roumezin',
    role: 'Secrétaire',
    initials: 'RR',
    color: 'from-amber-500 to-orange-400',
    photo: '/images/raphael.webp',
    desc: 'Raphaël assure le suivi administratif et la mémoire de l\'association — des comptes-rendus de réunion aux démarches officielles. Il est le garant de l\'organisation interne du club.',
  },
  {
    name: 'Marilou Sionneau',
    role: 'Chargée de communication',
    initials: 'MS',
    color: 'from-orange-300 to-amber-500',
    photo: '/images/marilou.webp',
    desc: 'Marilou donne une voix et une identité au club. Elle gère la communication et fait rayonner les actions du Club Quisine auprès de toute la communauté étudiante de Guardia et au-delà.',
  },
];

// Dégradés de repli pour les membres sans photo (couleur dérivée du nom)
const MEMBER_GRADIENTS = [
  'from-orange-300 to-orange-500',
  'from-amber-400 to-orange-400',
  'from-orange-400 to-red-400',
  'from-amber-300 to-orange-500',
  'from-orange-500 to-amber-400',
  'from-red-300 to-orange-400',
];

function initialsOf(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function gradientFor(name) {
  let sum = 0;
  for (const c of (name || '')) sum += c.charCodeAt(0);
  return MEMBER_GRADIENTS[sum % MEMBER_GRADIENTS.length];
}

function BureauMember({ member, index }) {
  const reverse = index % 2 !== 0;

  return (
    <div className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-10 lg:gap-16 items-center py-16 border-b border-orange-100 last:border-none`}>
      {/* Photo */}
      <div className="w-full lg:w-[340px] flex-shrink-0">
        <div className="relative rounded-3xl overflow-hidden aspect-[3/4] shadow-warm">
          {member.photo ? (
            <img
              src={member.photo}
              alt={member.name}
              className="w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchpriority={index === 0 ? 'high' : undefined}
              decoding={index === 0 ? 'sync' : 'async'}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${member.color} flex items-center justify-center`}>
              <span className="font-playfair text-7xl font-semibold text-white/80">
                {member.initials}
              </span>
            </div>
          )}
          {/* Role badge overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <span className="font-nunito text-xs font-bold tracking-[0.2em] uppercase text-orange-300">
              {member.role}
            </span>
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1">
        <h2 className="font-playfair text-4xl md:text-5xl font-semibold text-warm-900 leading-tight mb-6">
          {member.name}
        </h2>
        <div className="w-12 h-0.5 bg-orange-400 rounded-full mb-6" />
        <p className="font-nunito text-lg text-warm-600 leading-relaxed">
          {member.desc}
        </p>
      </div>
    </div>
  );
}

function MembreCard({ membre }) {
  return (
    <div className="group bg-white rounded-2xl p-5 shadow-cream hover:shadow-warm transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center">
      <div className={`w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br ${gradientFor(membre.name)} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300`}>
        {membre.photo_url
          ? <img src={membre.photo_url} alt={membre.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <span className="font-playfair text-xl font-semibold text-white">{initialsOf(membre.name)}</span>}
      </div>
      <h3 className="font-playfair text-base font-semibold text-warm-900 mb-1">{membre.name}</h3>
      <span className="font-nunito text-xs font-bold tracking-[0.15em] uppercase text-orange-400">{membre.role || 'Membre'}</span>
    </div>
  );
}

export default function Equipe() {
  const [membres, setMembres] = useState([]);

  useEffect(() => {
    api.team.list()
      .then(d => setMembres(d.members || []))
      .catch(() => setMembres([]));
  }, []);

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header />

      {/* Page header */}
      <section className="bg-warm-900 pt-[90px]">
        <div className="max-w-6xl mx-auto px-8 py-20 text-center">
          <span className="font-nunito text-sm font-bold tracking-[0.2em] uppercase text-orange-400 mb-5 block">
            Le bureau
          </span>
          <h1 className="font-playfair text-5xl md:text-6xl font-semibold italic text-white leading-tight mb-6">
            Notre équipe
          </h1>
          <p className="font-nunito text-lg text-white/65 max-w-xl mx-auto leading-relaxed">
            Une poignée d'étudiants passionnés qui mettent la main à la pâte chaque semaine pour régaler toute l'école.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-16">

        {/* Bureau — alternating */}
        <section className="mb-20">
          {bureau.map((m, i) => (
            <BureauMember key={m.name} member={m} index={i} />
          ))}
        </section>

        {/* Membres */}
        {membres.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-px bg-orange-100" />
              <h2 className="font-playfair text-2xl font-semibold italic text-warm-800">Nos membres</h2>
              <div className="flex-1 h-px bg-orange-100" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {membres.map((m) => (
                <MembreCard key={m.id} membre={m} />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-20 text-center bg-white rounded-3xl p-12 shadow-cream">
          <h2 className="font-playfair text-3xl font-semibold italic text-warm-900 mb-4">
            On cherche des événements à cuisiner
          </h2>
          <p className="font-nunito text-warm-600 mb-8 max-w-lg mx-auto leading-relaxed">
            Vous organisez un événement et cherchez une équipe pour assurer la restauration ? Contactez-nous, on sera ravis d'en discuter.
          </p>
          <a href="/contact" className="btn-primary inline-block">
            Contacter le club
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
