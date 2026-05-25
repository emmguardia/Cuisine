import { useState, useEffect } from 'react';

export default function Header({ solid = false }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrolled = solid || isScrolled;

  const navLinks = [
    { href: '/recettes', label: 'Recettes' },
    { href: '/equipe',   label: 'Notre équipe' },
    { href: '/contact',  label: 'Contact' },
    { href: '/faq',      label: 'FAQ' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled || menuOpen
          ? 'bg-[#FFFBF5] border-b border-orange-100 shadow-[0_4px_24px_rgba(255,140,66,0.15)]'
          : 'bg-transparent border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10 h-[70px] md:h-[90px] flex items-center justify-between">

        {/* Logo */}
        <a href="/" className="flex-shrink-0 group">
          <img
            src="/images/logo.png"
            alt="Club Quisine"
            className={`h-[52px] md:h-[88px] w-auto transition-all duration-300 group-hover:scale-105 ${
              scrolled || menuOpen ? '' : 'brightness-0 invert'
            }`}
          />
        </a>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`font-nunito text-[15px] font-semibold tracking-wide relative pb-0.5
                after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:rounded-full
                after:transition-all after:duration-300 hover:after:w-full transition-colors duration-300
                ${scrolled
                  ? 'text-warm-800 hover:text-orange-600 after:bg-orange-500'
                  : 'text-white/90 hover:text-white after:bg-white'
                }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-5">
          <a
            href="/login"
            className={`font-nunito text-[14px] font-semibold flex items-center gap-2 transition-colors duration-300 ${
              scrolled ? 'text-warm-700 hover:text-orange-500' : 'text-white/90 hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Connexion
          </a>
          <a
            href="/contact"
            className={`font-nunito text-[14px] font-bold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
              scrolled
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_4px_16px_rgba(255,140,66,0.35)] hover:shadow-[0_6px_24px_rgba(255,140,66,0.5)] hover:from-orange-600 hover:to-orange-700'
                : 'bg-white text-orange-600 shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.25)] hover:bg-orange-50'
            }`}
          >
            Nous contacter
          </a>
        </div>

        {/* Hamburger mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`md:hidden flex flex-col justify-center items-center w-9 h-9 gap-[5px] transition-colors duration-300 ${
            scrolled || menuOpen ? 'text-warm-800' : 'text-white'
          }`}
          aria-label="Menu"
        >
          <span className={`block h-[2px] w-6 bg-current rounded-full transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block h-[2px] w-6 bg-current rounded-full transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-[2px] w-6 bg-current rounded-full transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
      </div>

      {/* Menu mobile déroulant */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-96' : 'max-h-0'}`}>
        <div className="bg-[#FFFBF5] px-5 pb-6 flex flex-col gap-1 border-t border-orange-100">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-nunito text-[15px] font-semibold text-warm-800 hover:text-orange-600 py-3 border-b border-orange-50 last:border-none transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-3 pt-4">
            <a
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="font-nunito text-[14px] font-semibold text-warm-700 hover:text-orange-500 flex items-center gap-2 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Connexion
            </a>
            <a
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="ml-auto font-nunito text-[14px] font-bold px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_4px_16px_rgba(255,140,66,0.35)]"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
