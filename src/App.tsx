import { useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PhysicianSearch } from './components/PhysicianSearch';
import { Loader2 } from 'lucide-react';

function App() {
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

  return user ? <PhysicianSearch /> : <AuthForm />;
}

export default App;
