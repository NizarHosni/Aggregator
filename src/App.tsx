import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PhysicianSearch } from './components/PhysicianSearch';
import { DoctorProfile } from './components/DoctorProfile';
import { FavoritesPage } from './components/FavoritesPage';
import { AuthPage } from './components/AuthPage';
import { UserProfilePage } from './components/UserProfilePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <>
              <PhysicianSearch />
              <PWAInstallPrompt />
            </>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/doctor/:npi" element={<DoctorProfile />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
