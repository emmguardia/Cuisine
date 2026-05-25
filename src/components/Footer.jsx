const SocialIcon = ({ children, href, ariaLabel }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={ariaLabel}
    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-orange-500 transition-all duration-300 hover:scale-110"
  >
    <span className="text-white/70 hover:text-white transition-colors duration-300">
      {children}
    </span>
  </a>
);

export default function Footer() {
  const navLinks = [
    { href: '/', label: 'Accueil' },
    { href: '/recettes', label: 'Recettes' },
    { href: '/equipe', label: 'Notre équipe' },
    { href: '/faq', label: 'FAQ' },
    { href: '/contact', label: 'Contact' },
  ];

  const legalLinks = [
    { href: '/mentions-legales', label: 'Mentions légales' },
  ];

  return (
    <footer className="bg-warm-900 text-white/70">
      <div className="max-w-7xl mx-auto px-8 md:px-10 py-14">

        <div className="flex flex-col md:flex-row gap-12 md:gap-8 justify-between">

          {/* Brand */}
          <div className="flex flex-col gap-5 max-w-xs">
            <a href="/" className="inline-block">
              <img src="/images/logo.png" alt="Club Quisine" className="h-16 w-auto brightness-0 invert opacity-90" />
            </a>
            <p className="font-nunito text-sm leading-relaxed text-white/55">
              L'association culinaire de la Guardia Cybersecurity School. On cuisine chaque semaine pour les étudiants et on assure la restauration d'événements.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <SocialIcon href="#" ariaLabel="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163C15.204 2.163 15.584 2.175 16.85 2.233C20.102 2.381 21.621 3.924 21.769 7.152C21.827 8.417 21.838 8.797 21.838 12.001C21.838 15.206 21.826 15.585 21.769 16.85C21.62 20.075 20.105 21.621 16.85 21.769C15.584 21.827 15.206 21.839 12 21.839C8.796 21.839 8.416 21.827 7.151 21.769C3.891 21.62 2.38 20.07 2.232 16.849C2.174 15.584 2.162 15.205 2.162 12C2.162 8.796 2.175 8.417 2.232 7.151C2.381 3.924 3.896 2.38 7.151 2.232C8.417 2.175 8.796 2.163 12 2.163ZM12 0C8.741 0 8.333 0.014 7.053 0.072C2.695 0.272 0.273 2.69 0.073 7.052C0.014 8.333 0 8.741 0 12C0 15.259 0.014 15.668 0.072 16.948C0.272 21.306 2.69 23.728 7.052 23.928C8.333 23.986 8.741 24 12 24C15.259 24 15.668 23.986 16.948 23.928C21.302 23.728 23.73 21.31 23.927 16.948C23.986 15.668 24 15.259 24 12C24 8.741 23.986 8.333 23.928 7.053C23.732 2.699 21.311 0.273 16.949 0.073C15.668 0.014 15.259 0 12 0ZM12 5.838C8.597 5.838 5.838 8.597 5.838 12C5.838 15.403 8.597 18.163 12 18.163C15.403 18.163 18.162 15.404 18.162 12C18.162 8.597 15.403 5.838 12 5.838ZM12 16C9.791 16 8 14.21 8 12C8 9.791 9.791 8 12 8C14.209 8 16 9.791 16 12C16 14.21 14.209 16 12 16ZM18.406 4.155C17.61 4.155 16.965 4.8 16.965 5.595C16.965 6.39 17.61 7.035 18.406 7.035C19.201 7.035 19.845 6.39 19.845 5.595C19.845 4.8 19.201 4.155 18.406 4.155Z" />
                </svg>
              </SocialIcon>
              <SocialIcon href="#" ariaLabel="LinkedIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0H5C2.239 0 0 2.239 0 5V19C0 21.761 2.239 24 5 24H19C21.762 24 24 21.761 24 19V5C24 2.239 21.762 0 19 0ZM8 19H5V8H8V19ZM6.5 6.732C5.534 6.732 4.75 5.942 4.75 4.968C4.75 3.994 5.534 3.204 6.5 3.204C7.466 3.204 8.25 3.994 8.25 4.968C8.25 5.942 7.467 6.732 6.5 6.732ZM20 19H17V13.396C17 10.028 13 10.283 13 13.396V19H10V8H13V9.765C14.396 7.179 20 6.988 20 12.241V19Z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="font-nunito text-xs font-bold tracking-[0.18em] uppercase text-orange-400 mb-5">Navigation</p>
            <ul className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="font-nunito text-sm text-white/60 hover:text-orange-400 transition-colors duration-200">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="font-nunito text-xs font-bold tracking-[0.18em] uppercase text-orange-400 mb-5">Contact</p>
            <ul className="flex flex-col gap-3">
              <li>
                <a href="mailto:ddathueyt@guardiaschool.fr" className="font-nunito text-sm text-white/60 hover:text-orange-400 transition-colors duration-200">
                  ddathueyt@guardiaschool.fr
                </a>
              </li>
              <li className="font-nunito text-sm text-white/60 leading-relaxed">
                Guardia Cybersecurity School<br />
                50 Rue de Marseille<br />
                69007 Lyon
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-nunito text-xs text-white/35">
            &copy; {new Date().getFullYear()} Club Quisine — Association loi 1901
          </p>
          <div className="flex items-center gap-6">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="font-nunito text-xs text-white/35 hover:text-orange-400 transition-colors duration-200">
                {link.label}
              </a>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
