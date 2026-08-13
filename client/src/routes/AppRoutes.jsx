import Landing from '../components/Landing';
import Dashboard from '../components/Dashboard';
import ProtectedRoute from './ProtectedRoute';

/**
 * Central route composition for the current in-memory app flow.
 */
export default function AppRoutes({
  hasEntered,
  onEnter,
  onLogoClick,
  theme,
  onToggleTheme,
}) {
  if (!hasEntered) {
    return <Landing onEnter={onEnter} theme={theme} onToggleTheme={onToggleTheme} />;
  }

  return (
    <ProtectedRoute>
      <Dashboard
        onLogoClick={onLogoClick}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </ProtectedRoute>
  );
}
