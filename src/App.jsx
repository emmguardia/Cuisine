import { lazy, Suspense } from 'react';

const Home          = lazy(() => import('./pages/Home'));
const Recettes      = lazy(() => import('./pages/Recettes'));
const Equipe        = lazy(() => import('./pages/Equipe'));
const RecetteDetail = lazy(() => import('./pages/RecetteDetail'));
const FAQ           = lazy(() => import('./pages/FAQ'));
const Login         = lazy(() => import('./pages/Login'));
const Contact       = lazy(() => import('./pages/Contact'));
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Admin         = lazy(() => import('./pages/Admin'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4" role="status" aria-label="Chargement">
        <div className="w-10 h-10 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin" />
        <span className="font-nunito text-sm text-warm-500">Chargement…</span>
      </div>
    </div>
  );
}

function App() {
  const path = window.location.pathname;

  let Page;
  if      (path === '/recettes')         Page = Recettes;
  else if (path === '/equipe')           Page = Equipe;
  else if (path === '/recette')          Page = RecetteDetail;
  else if (path === '/faq')              Page = FAQ;
  else if (path === '/login')            Page = Login;
  else if (path === '/contact')          Page = Contact;
  else if (path === '/mentions-legales') Page = MentionsLegales;
  else if (path === '/dashboard')        Page = Dashboard;
  else if (path === '/admin')            Page = Admin;
  else                                   Page = Home;

  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  );
}

export default App;
