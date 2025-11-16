import { useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PhysicianSearch } from './components/PhysicianSearch';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <PhysicianSearch /> : <AuthForm />;
}

export default App;
