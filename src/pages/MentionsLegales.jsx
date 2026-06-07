import Header from '../components/Header';
import Footer from '../components/Footer';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="font-playfair text-2xl font-semibold text-warm-900 mb-4 pb-3 border-b border-orange-100">
        {title}
      </h2>
      <div className="font-nunito text-warm-600 leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="font-semibold text-warm-800 sm:w-52 flex-shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function MentionsLegales() {
  return (
    <div className="w-full min-h-screen bg-cream-100">
      <Header solid />

      <main className="pt-[90px]">
        <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">

          <div className="mb-14">
            <span className="font-nunito text-sm font-bold tracking-[0.18em] uppercase text-orange-500 mb-4 block">Légal</span>
            <h1 className="font-playfair text-5xl font-semibold italic text-warm-900">
              Mentions légales
            </h1>
            <p className="font-nunito text-sm text-warm-500 mt-3">Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance en l'économie numérique.</p>
          </div>

          <div className="bg-white rounded-3xl p-8 md:p-10 shadow-cream">

            <Section title="Éditeur du site">
              <Row label="Nom de l'association">Club Quisine</Row>
              <Row label="Forme juridique">Association loi 1901</Row>
              <Row label="Siège social">50 Rue de Marseille<br />69007 Lyon, France</Row>
              <Row label="Responsable de publication">Damien Dathueyt, Président</Row>
              <Row label="Contact éditeur">ddathueyt@guardiaschool.fr</Row>
            </Section>

            <Section title="Développement & technique">
              <Row label="Responsable technique">Enzo Monnet-Mata, Trésorier</Row>
              <Row label="Contact technique">emonnet-mata@guardiaschool.fr</Row>
            </Section>

            <Section title="Hébergement">
              <Row label="Hébergeur">Infrastructure auto-hébergée sur serveur dédié</Row>
              <Row label="Prestataire serveur">Serveur dédié auto-hébergé — propriété privée</Row>
              <Row label="Gestion DNS & certificats">Cloudflare, Inc.<br />101 Townsend St, San Francisco, CA 94107, USA</Row>
            </Section>

            <Section title="Propriété intellectuelle">
              <p>L'ensemble du contenu de ce site (textes, images, logo, structure) est la propriété de l'association Club Quisine, sauf mention contraire. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
              <p>Le logo "Club Quisine" est une création originale de l'association. Les photographies issues de sources tierces (Unsplash) sont utilisées sous licence libre.</p>
            </Section>

            <Section title="Données personnelles & RGPD">
              <p>Ce site est un site vitrine. Il ne collecte aucune donnée personnelle à des fins de traçage ou de profilage.</p>
              <p><strong className="text-warm-800">Formulaire de contact</strong> — Les informations renseignées (nom, email, message) sont transmises par email directement au responsable de publication. Elles ne sont ni stockées en base de données, ni transmises à des tiers.</p>
              <p><strong className="text-warm-800">Cookies</strong> — Ce site n'utilise aucun cookie de traçage ou publicitaire. Seuls des cookies techniques strictement nécessaires au bon fonctionnement du site peuvent être utilisés.</p>
              <p><strong className="text-warm-800">Droit d'accès et de suppression</strong> — Conformément au RGPD (Règlement UE 2016/679), vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ce droit, contactez-nous à <a href="mailto:ddathueyt@guardiaschool.fr" className="text-orange-500 hover:text-orange-600 transition-colors">ddathueyt@guardiaschool.fr</a>.</p>
            </Section>

            <Section title="Limitation de responsabilité">
              <p>Club Quisine s'efforce d'assurer l'exactitude des informations publiées sur ce site, mais ne peut garantir l'exhaustivité ou l'absence d'erreurs. L'association décline toute responsabilité quant aux éventuels dommages liés à l'utilisation de ce site ou à l'indisponibilité temporaire du service.</p>
              <p>Les liens vers des sites tiers sont fournis à titre informatif. Club Quisine n'est pas responsable du contenu de ces sites externes.</p>
            </Section>

            <p className="font-nunito text-xs text-warm-400 mt-8 pt-6 border-t border-orange-100">
              Dernière mise à jour : 7 Juin 2026
            </p>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
