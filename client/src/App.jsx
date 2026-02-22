import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';

function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('tr-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tr-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  if (!hasEntered) {
    return <Landing onEnter={() => setHasEntered(true)} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <Dashboard
      onLogoClick={() => setHasEntered(false)}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;
