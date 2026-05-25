import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'C\'est quoi Club Quisine exactement ?',
      answer: 'Club Quisine est l\'association culinaire de la Guardia Cybersecurity School, fondée au sein du groupe Quest Education. On cuisine des plats faits maison chaque semaine pour les étudiants, à des prix très accessibles. On intervient aussi lors d\'événements pour assurer la restauration.'
    },
    {
      question: 'Combien coûtent vos repas ?',
      answer: 'Nos repas sont pensés pour les budgets étudiants — on essaie de rester au plus bas possible tout en proposant des plats de qualité. Les tarifs varient selon les plats et les événements, mais l\'idée est que tout le monde puisse en profiter.'
    },
    {
      question: 'Vous cuisinez pour quel type d\'événements ?',
      answer: 'On a déjà eu l\'occasion de cuisiner lors de game jams et hackathons — des événements longs où les participants ont besoin de manger sans quitter leur poste. C\'est exactement le genre de contexte qu\'on adore : nourrir des gens qui bossent dur. On est ouverts à d\'autres formats similaires, n\'hésitez pas à nous soumettre votre idée.'
    },
    {
      question: 'On peut vous proposer un événement même si on n\'est pas de Guardia ?',
      answer: 'Oui ! Notre association est rattachée à Guardia et Quest Education, mais on reste ouverts aux propositions extérieures. N\'hésitez pas à nous contacter pour en discuter — on verra ensemble si c\'est faisable.'
    },
    {
      question: 'Comment se passe une commande ou une collaboration ?',
      answer: 'Tout commence par un message. Vous nous décrivez votre événement, le nombre de personnes, le type de repas souhaité. On revient vers vous rapidement pour voir si on peut s\'organiser et vous proposer quelque chose.'
    },
    {
      question: 'Comment nous contacter ?',
      answer: 'Via le formulaire sur la page Contact, ou directement par email à ddathueyt@guardiaschool.fr. On lit tous les messages et on répond dès que possible.'
    },
    {
      question: 'Où se trouve Guardia Cybersecurity School ?',
      answer: 'Guardia Cybersecurity School est située au 50 Rue de Marseille, 69007 Lyon, au sein du groupe Quest Education.'
    },
  ];

  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header solid />

      <main className="pt-[90px]">
        <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">

          <div className="mb-14">
            <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">FAQ</span>
            <h1 className="font-playfair text-5xl md:text-6xl font-semibold italic text-warm-900">
              Questions fréquentes
            </h1>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-cream overflow-hidden transition-shadow duration-300 hover:shadow-warm"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-7 py-5 flex items-center justify-between text-left gap-4"
                >
                  <span className="font-playfair text-lg font-semibold text-warm-900 flex-1">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-orange-500 transition-transform duration-300 flex-shrink-0 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-7 pb-6 animate-fade-in">
                    <div className="w-8 h-0.5 bg-orange-200 rounded-full mb-4" />
                    <p className="font-nunito text-warm-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-14 bg-white rounded-2xl p-8 shadow-cream text-center">
            <p className="font-nunito text-warm-600 mb-5">Vous n'avez pas trouvé la réponse à votre question ?</p>
            <a href="/contact" className="btn-primary inline-block">
              Nous écrire directement
            </a>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
