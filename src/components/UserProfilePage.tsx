import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Calendar, ArrowLeft, LogOut, Key } from 'lucide-react';
import { ProtectedRoute } from './ProtectedRoute';

function ProfileContent() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card-strong rounded-3xl p-6 sm:p-8 shadow-professional-lg animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-medical flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-heading text-xl sm:text-2xl">Profile</h2>
                <p className="text-body text-sm mt-1">Manage your account</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* User Avatar & Name */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-heading text-lg font-semibold">
                    {user.name || 'User'}
                  </h3>
                  <p className="text-body text-sm">{user.email}</p>
                  <div className="mt-1">
                    {user.emailVerified ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        ✓ Email Verified
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                        ! Email Not Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-subheading text-sm font-semibold uppercase tracking-wide mb-4">
                Account Information
              </h3>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-body text-xs font-semibold uppercase tracking-wide mb-1">Email</p>
                  <p className="text-heading">{user.email}</p>
                </div>
              </div>

              {user.name && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-body text-xs font-semibold uppercase tracking-wide mb-1">Name</p>
                    <p className="text-heading">{user.name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-body text-xs font-semibold uppercase tracking-wide mb-1">Member Since</p>
                  <p className="text-heading">
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <h3 className="text-subheading text-sm font-semibold uppercase tracking-wide mb-4">
                Quick Actions
              </h3>

              <Link
                to="/favorites"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <span className="text-xl">❤️</span>
                </div>
                <div>
                  <p className="text-heading font-medium">Favorite Doctors</p>
                  <p className="text-body text-xs">View your saved doctors</p>
                </div>
              </Link>

              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-xl">🔍</span>
                </div>
                <div>
                  <p className="text-heading font-medium">Search History</p>
                  <p className="text-body text-xs">View your recent searches</p>
                </div>
              </button>

              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-left border-t border-gray-200 dark:border-gray-700 mt-4 pt-4"
              >
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-red-600 font-medium">Sign Out</p>
                  <p className="text-body text-xs">Log out of your account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
