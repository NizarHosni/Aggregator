import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PhysicianSearch } from './components/PhysicianSearch';
import { DoctorProfile } from './components/DoctorProfile';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsPage } from './components/SettingsPage';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
          <div className="spinner-professional mx-auto mb-6" />
          <h2 className="text-heading text-xl mb-2">Loading...</h2>
          <p className="text-body text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // AUTHENTICATION REQUIRED - Redirect to login if not authenticated
  if (!user) {
    // Store the current path to return after login
    const returnPath = location.pathname + location.search;
    return <Navigate to={`/auth?return=${encodeURIComponent(returnPath)}`} replace />;
  }

  return <>{children}</>;
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
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Initialize app - don't block on auth
    const initializeApp = async () => {
      try {
        // Very small delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        setAppReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        // Still set ready - don't block app
        setAppReady(true);
      }
    };

    void initializeApp();
  }, []);

  // Show loading state with better UI
  if (!appReady) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <h2 style={{ marginBottom: '10px', fontSize: '1.5rem', fontWeight: 600 }}>YoDoc Healthcare Search</h2>
        <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Initializing application...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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
