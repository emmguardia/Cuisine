import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../lib/api';

const EMPTY = { name: '', email: '', subject: '', message: '', website: '' };

export default function Contact() {
  const [formData, setFormData] = useState(EMPTY);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await api.contact.send(formData);
      setFormData(EMPTY);
      setStatus('sent');
    } catch (err) {
      setError(err.status === 400
        ? 'Vérifiez les champs : nom sans lien ni chiffres, email valide, message d\'au moins 10 caractères.'
        : err.message);
      setStatus('error');
    }
  };

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header solid />

      <main className="pt-[90px]">
        <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">

          <div className="mb-14">
            <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">Contact</span>
            <h1 className="font-playfair text-5xl md:text-6xl font-semibold italic text-warm-900">
              Parlons-en
            </h1>
          </div>

          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-start">

            {/* Colonne gauche */}
            <div className="flex flex-col gap-8">

              <p className="font-nunito text-lg text-warm-600 leading-relaxed">
                Une idée d'événement, une question sur le club ou une envie de collaborer ? On répond à tous les messages. Écrivez-nous directement ou utilisez le formulaire.
              </p>

              {/* Raisons */}
              <div className="flex flex-col gap-4">
                {[
                  {
                    title: 'Proposer un événement',
                    desc: 'Vous organisez quelque chose et cherchez une équipe pour cuisiner ? C\'est exactement ce qu\'on cherche.',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    ),
                  },
                  {
                    title: 'Poser une question',
                    desc: 'Sur nos repas de la semaine, nos recettes, ou le fonctionnement du club — on est disponibles.',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ),
                  },
                  {
                    title: 'Partenariat ou presse',
                    desc: 'Vous souhaitez parler du club ou monter quelque chose ensemble ? Notre boîte mail est ouverte.',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    ),
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 bg-white rounded-2xl p-5 shadow-cream">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-playfair font-semibold text-warm-900 mb-1">{item.title}</h3>
                      <p className="font-nunito text-sm text-warm-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Infos */}
              <div className="flex flex-col gap-3 pt-2">
                <a href="mailto:clubquisine@guardiaschool.fr" className="flex items-center gap-3 font-nunito text-sm text-warm-600 hover:text-orange-500 transition-colors">
                  <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  clubquisine@guardiaschool.fr
                </a>
                <span className="flex items-start gap-3 font-nunito text-sm text-warm-600">
                  <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Guardia Cybersecurity School — 50 Rue de Marseille, 69007 Lyon
                </span>
              </div>
            </div>

            {/* Colonne droite — formulaire */}
            <div className="bg-white rounded-3xl p-8 shadow-cream">
              <h2 className="font-playfair text-2xl font-semibold text-warm-900 mb-6">
                Envoyer un message
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="font-nunito block text-sm font-semibold text-warm-700 mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="font-nunito w-full px-4 py-3 rounded-xl border-2 border-orange-100 bg-cream-100 focus:outline-none focus:border-orange-300 focus:bg-white transition-all duration-200"
                    placeholder="Prénom Nom"
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <label className="font-nunito block text-sm font-semibold text-warm-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="font-nunito w-full px-4 py-3 rounded-xl border-2 border-orange-100 bg-cream-100 focus:outline-none focus:border-orange-300 focus:bg-white transition-all duration-200"
                    placeholder="vous@exemple.fr"
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </div>

                <div>
                  <label className="font-nunito block text-sm font-semibold text-warm-700 mb-2">Sujet</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="font-nunito w-full px-4 py-3 rounded-xl border-2 border-orange-100 bg-cream-100 focus:outline-none focus:border-orange-300 focus:bg-white transition-all duration-200"
                    placeholder="Proposition d'événement, question..."
                    maxLength={150}
                    required
                  />
                </div>

                <div>
                  <label className="font-nunito block text-sm font-semibold text-warm-700 mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    rows={6}
                    className="font-nunito w-full px-4 py-3 rounded-xl border-2 border-orange-100 bg-cream-100 focus:outline-none focus:border-orange-300 focus:bg-white transition-all duration-200 resize-none"
                    placeholder="Décrivez votre projet ou votre question..."
                    minLength={10}
                    maxLength={5000}
                    required
                  />
                </div>

                {/* Champ piège : invisible pour les visiteurs, rempli par les robots. */}
                <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                  <label>
                    Site web
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                    />
                  </label>
                </div>

                {status === 'sent' && (
                  <p role="status" className="font-nunito text-sm text-green-800 bg-green-50 rounded-xl px-4 py-3">
                    Message envoyé. Un accusé de réception vient de partir à votre adresse, on vous répond vite.
                  </p>
                )}
                {status === 'error' && (
                  <p role="alert" className="font-nunito text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
                >
                  {status === 'sending' ? 'Envoi…' : 'Envoyer le message'}
                </button>
              </form>
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}


