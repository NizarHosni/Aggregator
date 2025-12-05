import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Stethoscope, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (user) {
      // Get return path from URL or default to home
      const urlParams = new URLSearchParams(window.location.search);
      const returnPath = urlParams.get('return') || '/';
      navigate(returnPath, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        // Success - clear any redirect flags to prevent loops
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auth_redirect_in_progress');
        }
        
        // Wait a moment for token to be saved and validated
        // Then get return path from URL or default to home
        await new Promise(resolve => setTimeout(resolve, 100));
        const urlParams = new URLSearchParams(window.location.search);
        const returnPath = urlParams.get('return') || '/';
        navigate(returnPath, { replace: true });
        // Note: setLoading(false) not needed as navigate will unmount component
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 animate-scale-in">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-medical flex items-center justify-center shadow-professional-lg">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-heading text-3xl sm:text-4xl mb-3">
            Find Real Doctors
          </h2>
          <p className="text-body text-base">
            Verified US healthcare providers with phone numbers & reviews
          </p>
        </div>

        <div className="glass-card-strong rounded-3xl p-8 shadow-professional-lg">
          <div className="flex border-b border-gray-200/50 mb-6">
            <button
              onClick={() => {
                setIsSignUp(false);
                setError('');
                setConfirmPassword('');
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                !isSignUp
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-body hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsSignUp(true);
                setError('');
                setConfirmPassword('');
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                isSignUp
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-body hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="glass-card rounded-xl p-4 border border-red-200 bg-red-50/50 animate-fade-in">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-subheading text-sm mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-professional"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-subheading text-sm mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-professional pr-16"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {isSignUp && (
                <p className="mt-2 text-xs text-body">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirm-password" className="block text-subheading text-sm mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-professional pr-16"
                    placeholder="Repeat password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base py-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                  Please wait...
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-5 h-5 inline mr-2" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 inline mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-body text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setConfirmPassword('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
