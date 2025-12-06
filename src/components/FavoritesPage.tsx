import { useNavigate } from 'react-router-dom';
import { Heart, Stethoscope, Phone, MapPin, Star, Clock, Trash2, ArrowLeft } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { useSEO } from '../hooks/useSEO';

export function FavoritesPage() {
  const navigate = useNavigate();
  const { favorites, loading, removeFavorite } = useFavorites();

  useSEO({
    title: 'Favorite Doctors - YoDoc Healthcare Search',
    description: 'Your saved favorite doctors and healthcare providers',
    keywords: 'favorite doctors, saved doctors, bookmarked physicians',
  });

  const handleRemoveFavorite = async (npi: string, name: string) => {
    if (confirm(`Remove ${name} from favorites?`)) {
      await removeFavorite(npi);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center glass-card rounded-3xl p-12 shadow-professional-lg">
          <div className="spinner-professional mx-auto mb-6" />
          <h2 className="text-heading text-xl mb-2">Loading Favorites...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="sticky top-0 z-50 glass-card-strong border-b border-gray-200/50 shadow-professional">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="btn-secondary text-sm py-2 px-4"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Back to Search
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-heading text-xl sm:text-2xl">
                    Favorite Doctors
                  </h1>
                  <p className="text-body text-xs sm:text-sm">
                    {favorites.length} saved {favorites.length === 1 ? 'doctor' : 'doctors'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {favorites.length === 0 ? (
          // Empty State
          <div className="glass-card-strong rounded-3xl p-12 shadow-professional-lg text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-100 to-red-100 flex items-center justify-center">
              <Heart className="w-12 h-12 text-pink-500" />
            </div>
            <h2 className="text-heading text-2xl mb-4">No Favorite Doctors Yet</h2>
            <p className="text-body text-lg mb-6 max-w-md mx-auto">
              Start searching for doctors and click the heart icon to save your favorites!
            </p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary text-base py-3 px-6"
            >
              <Stethoscope className="w-5 h-5 inline mr-2" />
              Start Searching
            </button>
          </div>
        ) : (
          // Favorites Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((doctor, index) => (
              <div
                key={doctor.npi}
                className="doctor-card animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-heading text-lg mb-1 truncate">{doctor.name}</h3>
                        <p className="text-body text-sm flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="truncate">{doctor.specialty}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-body text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{doctor.location}</span>
                  </div>

                  <div className="flex items-center gap-2 text-body text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a 
                      href={`tel:${doctor.phone}`} 
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      {doctor.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    {doctor.rating && Number(doctor.rating) > 0 && (
                      <div className="flex items-center gap-1 badge-rating">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="font-semibold">{Number(doctor.rating).toFixed(1)}</span>
                      </div>
                    )}
                    <div className="badge-experience">
                      <Clock className="w-3 h-3 inline mr-1" />
                      <span>{doctor.years_experience || 0}+ years</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => navigate(`/doctor/${doctor.npi}`)}
                      className="flex-1 btn-primary text-sm justify-center"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => handleRemoveFavorite(doctor.npi, doctor.name)}
                      className="btn-secondary text-sm px-4 text-red-600 hover:bg-red-50 border-red-200"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

