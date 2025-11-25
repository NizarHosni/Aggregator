import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PhysicianSearch } from './components/PhysicianSearch';
import { DoctorProfile } from './components/DoctorProfile';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsPage } from './components/SettingsPage';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg animate-scale-in">
          <div className="spinner-professional mx-auto mb-6" />
          <p className="text-body font-semibold text-lg">Loading...</p>
          <p className="text-body text-sm mt-2">Please wait while we verify your session</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
        <h1 className="text-heading text-3xl mb-4">404</h1>
        <p className="text-body text-lg mb-6">Page not found</p>
        <a href="/" className="btn-primary">
          Go to Homepage
        </a>
      </div>
    </div>
  );
}

function App() {
  // Add safety check for critical dependencies
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PhysicianSearch />
                <PWAInstallPrompt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/:npi"
            element={
              <ProtectedRoute>
                <DoctorProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthForm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
          <h1 className="text-heading text-2xl mb-4">Error Loading App</h1>
          <p className="text-body mb-6">Please refresh the page.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default App;
