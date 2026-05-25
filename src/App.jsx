import { lazy, Suspense } from 'react';

const Home          = lazy(() => import('./pages/Home'));
const Recettes      = lazy(() => import('./pages/Recettes'));
const Equipe        = lazy(() => import('./pages/Equipe'));
const RecetteDetail = lazy(() => import('./pages/RecetteDetail'));
const FAQ           = lazy(() => import('./pages/FAQ'));
const Login         = lazy(() => import('./pages/Login'));
const Contact       = lazy(() => import('./pages/Contact'));
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'));

function App() {
  const path = window.location.pathname;

  let Page;
  if      (path === '/recettes')        Page = Recettes;
  else if (path === '/equipe')          Page = Equipe;
  else if (path === '/recette')         Page = RecetteDetail;
  else if (path === '/faq')             Page = FAQ;
  else if (path === '/login')           Page = Login;
  else if (path === '/contact')         Page = Contact;
  else if (path === '/mentions-legales') Page = MentionsLegales;
  else                                  Page = Home;

  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-100" />}>
      <Page />
    </Suspense>
  );
}

export default App;
