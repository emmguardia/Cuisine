import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authClient } from '../lib/auth-client';

export default function Login() {
  const { data: session, isPending } = authClient.useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Déjà connecté → redirection accueil
  useEffect(() => {
    if (!isPending && session) {
      window.location.href = '/recettes';
    }
  }, [session, isPending]);

  // Erreur OAuth renvoyée par Better Auth via query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError("Accès refusé. Votre compte n'est pas autorisé à accéder à cet espace.");
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/recettes',
      });
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  if (isPending) {
    return <div className="min-h-screen bg-cream-100" />;
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-pastel-vanilla via-white to-pastel-cream">
      <Header solid />

      <main className="pt-[100px] pb-16">
        <section className="relative max-w-[1920px] mx-auto px-8 md:px-16 lg:px-24 py-12 md:py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pastel-cream/30 to-transparent -z-10" />

          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-10 shadow-soft-lg">

              {/* Logo / icône */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-pastel-peach flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </div>
              </div>

              {/* Titre */}
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-semibold mb-2 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                  Espace membres
                </h1>
                <p className="text-gray-500 text-sm">
                  Réservé aux membres de l'association
                </p>
              </div>

              {/* Erreur */}
              {error && (
                <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
                  {error}
                </div>
              )}

              {/* Bouton Google */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {isLoading ? 'Redirection…' : 'Continuer avec Google'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-6">
                Seuls les membres de l'association Club Quisine ont accès à cet espace.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
