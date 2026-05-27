import { useState, useEffect, useRef } from 'react';
import { authClient } from '../lib/auth-client';

export default function Header({ solid = false }) {
  const [isScrolled, setIsScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = '/';
  };

  const scrolled = solid || isScrolled;

  const navLinks = [
    { href: '/recettes', label: 'Recettes' },
    { href: '/equipe',   label: 'Notre équipe' },
    { href: '/contact',  label: 'Contact' },
    { href: '/faq',      label: 'FAQ' },
  ];

  // Initiales de l'utilisateur pour l'avatar de secours
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

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
          {!isPending && !user && (
            <>
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
            </>
          )}

          {!isPending && user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2.5 group"
                aria-label="Menu utilisateur"
              >
                {/* Avatar */}
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-200 group-hover:ring-orange-400 transition-all"
                  />
                ) : (
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-orange-200 group-hover:ring-orange-400 transition-all ${
                    scrolled ? 'bg-orange-100 text-orange-700' : 'bg-white/20 text-white'
                  }`}>
                    {initials}
                  </span>
                )}
                <span className={`font-nunito text-[14px] font-semibold hidden lg:block transition-colors duration-300 ${
                  scrolled ? 'text-warm-800 group-hover:text-orange-600' : 'text-white/90 group-hover:text-white'
                }`}>
                  {user.name?.split(' ')[0]}
                </span>
                {/* Chevron */}
                <svg className={`w-3.5 h-3.5 transition-all duration-200 ${dropdownOpen ? 'rotate-180' : ''} ${scrolled ? 'text-warm-600' : 'text-white/70'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-orange-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-orange-50">
                    <p className="text-sm font-semibold text-warm-800 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    {user.role === 'admin' && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="p-1">
                    <a href="/dashboard"
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors duration-200 flex items-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                      </svg>
                      Mes recettes
                    </a>
                    {user.role === 'admin' && (
                      <a href="/admin"
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors duration-200 flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        Administration
                      </a>
                    )}
                    <div className="border-t border-orange-50 mt-1 pt-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200 flex items-center gap-2.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Déconnexion
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-[480px]' : 'max-h-0'}`}>
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
            {!isPending && !user && (
              <>
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
              </>
            )}

            {!isPending && user && (
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-200"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-bold">
                      {initials}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-warm-800 leading-tight">{user.name?.split(' ')[0]}</p>
                    {user.role === 'admin' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Admin</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="font-nunito text-[13px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
