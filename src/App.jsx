import Home from './pages/Home';
import Recettes from './pages/Recettes';
import Equipe from './pages/Equipe';
import RecetteDetail from './pages/RecetteDetail';
import FAQ from './pages/FAQ';
import Login from './pages/Login';
import Contact from './pages/Contact';
import MentionsLegales from './pages/MentionsLegales';

function App() {
  const path = window.location.pathname;

  if (path === '/recettes') return <Recettes />;
  if (path === '/equipe') return <Equipe />;
  if (path === '/recette') return <RecetteDetail />;
  if (path === '/faq') return <FAQ />;
  if (path === '/login') return <Login />;
  if (path === '/contact') return <Contact />;
  if (path === '/mentions-legales') return <MentionsLegales />;

  return <Home />;
}

export default App;
