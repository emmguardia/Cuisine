import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(isLogin ? 'Login' : 'Register', formData);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-pastel-vanilla via-white to-pastel-cream">
      <Header solid />
      
      <main className="pt-[100px] pb-16">
        <section className="relative max-w-[1920px] mx-auto px-8 md:px-16 lg:px-24 py-12 md:py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pastel-cream/30 to-transparent -z-10" />
          
          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-10 shadow-soft-lg">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-semibold mb-2 bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                  {isLogin ? 'Connexion' : 'Inscription'}
                </h1>
                <p className="text-gray-600">
                  {isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte'}
                </p>
              </div>

              <div className="flex gap-2 mb-6 bg-pastel-peach/30 p-1 rounded-xl">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isLogin
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-soft'
                      : 'text-gray-600 hover:text-orange-600'
                  }`}
                >
                  Connexion
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all duration-300 ${
                    !isLogin
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-soft'
                      : 'text-gray-600 hover:text-orange-600'
                  }`}
                >
                  Inscription
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-pastel-peach rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-200 focus:border-orange-300 transition-all duration-300"
                      required={!isLogin}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-pastel-peach rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-200 focus:border-orange-300 transition-all duration-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-pastel-peach rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-200 focus:border-orange-300 transition-all duration-300"
                    required
                  />
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-pastel-peach rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-200 focus:border-orange-300 transition-all duration-300"
                      required={!isLogin}
                    />
                  </div>
                )}

                {isLogin && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" className="rounded border-pastel-peach text-orange-600 focus:ring-orange-200" />
                      <span>Se souvenir de moi</span>
                    </label>
                    <a href="#" className="text-sm text-orange-600 hover:text-orange-700">
                      Mot de passe oublié ?
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-soft hover:shadow-soft-lg"
                >
                  {isLogin ? 'Se connecter' : 'S\'inscrire'}
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


