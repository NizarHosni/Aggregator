import { useState, useRef } from 'react';
import { Search, LogOut, User, Stethoscope, Copy, Check, AlertCircle, Phone, MapPin, Star, Clock, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { SearchHistory } from './SearchHistory';
import { useSEO } from '../hooks/useSEO';

interface SearchResult {
  query: string;
  specialty: string;
  location: string | { formatted_address: string; name?: string; location?: { lat: number; lng: number } } | null;
  results: Array<{
    name: string;
    specialty: string;
    location: string;
    phone: string;
    rating: number;
    years_experience: number;
    npi?: string;
  }>;
  resultsCount: number;
  error?: string | null;
  suggestions?: string[] | null;
  searchRadius?: number | null;
  pagination?: {
    currentPage: number;
    resultsPerPage: number;
    totalPages: number;
    hasMore: boolean;
    totalResults: number;
  };
}

interface DoctorCardProps {
  doctor: {
    name: string;
    specialty: string;
    location: string;
    phone: string;
    rating: number;
    years_experience: number;
    npi?: string;
  };
  index: number;
}

function DoctorCard({ doctor, index }: DoctorCardProps) {
  return (
    <div 
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
          {doctor.rating > 0 && (
            <div className="flex items-center gap-1 badge-rating">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
            </div>
          )}
          <div className="badge-experience">
            <Clock className="w-3 h-3 inline mr-1" />
            <span>{doctor.years_experience}+ years</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhysicianSearch() {
  const { user, signOut } = useAuth();
  const { addToHistory } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(5);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [allResults, setAllResults] = useState<SearchResult['results']>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // SEO optimization
  useSEO({
    title: 'Find Doctors Near You - Real Phone Numbers & Reviews | YoDoc',
    description: 'Find real doctors with phone numbers, addresses, and ratings. Search by name, specialty, and location. Contact healthcare providers directly. Verified US healthcare provider database.',
    keywords: 'find doctors, doctor search, physicians near me, healthcare providers, doctor phone numbers, medical specialists, find doctors near me, doctor directory, physician directory',
  });

  const handleSearch = async (e: React.FormEvent, page: number = 1) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (page === 1) {
      setSearching(true);
      setShowHistory(false);
      setAllResults([]);
      setCurrentPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const { searchApi } = await import('../lib/api');
      const radiusInMeters = searchRadius * 1000;
      const results = await searchApi.searchPhysicians(query, radiusInMeters, page, 15);

      if (page === 1) {
        // First page - replace results
        setSearchResults(results);
        setAllResults(results.results);
        setCurrentPage(1);
        setHasMoreResults(results.pagination?.hasMore || false);

        await addToHistory(
          results.query,
          results.specialty,
          getLocationText(results.location),
          results.resultsCount
        );
      } else {
        // Subsequent pages - append results
        setAllResults(prev => [...prev, ...results.results]);
        setCurrentPage(page);
        setHasMoreResults(results.pagination?.hasMore || false);
      }

      if (page === 1) {
        setQuery('');
        setShowHistory(false);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      
      let errorMessage = 'Search failed. Please try again.';
      
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. The search will use fallback results, but they may be limited. Please check your OpenAI account billing.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (page === 1) {
        setSearchResults({
          query: query,
          specialty: 'Unknown',
          location: null,
          results: [],
          resultsCount: 0,
          error: errorMessage,
        });
      }
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = async () => {
    if (!searchResults || loadingMore || !hasMoreResults) return;
    
    const nextPage = currentPage + 1;
    setLoadingMore(true);

    try {
      const { searchApi } = await import('../lib/api');
      const radiusInMeters = searchRadius * 1000;
      const results = await searchApi.searchPhysicians(searchResults.query, radiusInMeters, nextPage, 15);

      setAllResults(prev => [...prev, ...results.results]);
      setCurrentPage(nextPage);
      setHasMoreResults(results.pagination?.hasMore || false);
    } catch (error: any) {
      console.error('Load more error:', error);
    } finally {
      setLoadingMore(false);
    }
    
    // Smooth scroll to new results after a brief delay
    setTimeout(() => {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  const handleSelectSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setShowHistory(false);
    setSearchResults(null);
    setAllResults([]);
    setCurrentPage(1);
    setHasMoreResults(false);
  };

  const getLocationText = (location: SearchResult['location']): string => {
    if (!location) return 'Not specified';
    if (typeof location === 'string') return location;
    return location.formatted_address || 'Not specified';
  };

  const formatResultsText = (results: SearchResult): string => {
    if (results.error) {
      return `Search Error: ${results.error}\n\nSearch Query: "${results.query}"`;
    }

    if (results.resultsCount === 0) {
      return `No physicians found matching "${results.query}"`;
    }

    const resultsText = allResults
      .map((p, i) => `${i + 1}. ${p.name} - ${p.specialty}\n   ${p.location} | ${p.phone} | ⭐ ${p.rating}/5`)
      .join('\n\n');

    return `Found ${results.resultsCount} physician${results.resultsCount !== 1 ? 's' : ''} matching "${results.query}"\n\nResults:\n\n${resultsText}`;
  };

  const handleCopyResults = async () => {
    if (!searchResults) return;
    
    const textToCopy = formatResultsText(searchResults);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Professional Header */}
      <div className="sticky top-0 z-50 glass-card-strong border-b border-gray-200/50 shadow-professional">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-medical flex items-center justify-center shadow-lg">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-heading text-xl sm:text-2xl">
                  Find Real Doctors
                </h1>
                <p className="text-body text-xs sm:text-sm hidden sm:block">
                  Verified US healthcare providers with phone numbers & reviews
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-body px-3 py-2 rounded-lg bg-white/50">
                <User className="w-4 h-4" />
                <span className="max-w-[150px] truncate">{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="btn-secondary text-sm py-2 px-4"
              >
                <LogOut className="w-4 h-4 inline mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <div className="glass-card-strong rounded-3xl p-6 sm:p-8 mb-8 shadow-professional-lg animate-scale-in">
          <h2 className="text-heading text-xl sm:text-2xl mb-6 flex items-center gap-3">
            <Search className="w-6 h-6 text-blue-600" />
            Search by Name, Specialty, or Location
          </h2>
          
          <form onSubmit={(e) => handleSearch(e, 1)} className="space-y-6">
            <div>
              <label htmlFor="search" className="block text-subheading text-sm mb-2">
                Search for physicians
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "Retina Surgeons in Tacoma" or "Dr. Smith Orthopedic Kansas City"'
                  className="input-professional pl-12 pr-4 py-4 text-base"
                  disabled={searching}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-blue-100/50">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="radius" className="text-subheading text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Search Radius
                </label>
                <span className="text-lg font-bold text-blue-600 bg-white px-4 py-1.5 rounded-xl shadow-sm">
                  {searchRadius} km
                </span>
              </div>
              <div className="relative">
                <input
                  id="radius"
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  className="w-full h-3 bg-gradient-to-r from-blue-200 via-blue-300 to-indigo-300 rounded-full appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((searchRadius - 1) / 49) * 100}%, #e5e7eb ${((searchRadius - 1) / 49) * 100}%, #e5e7eb 100%)`
                  }}
                  disabled={searching}
                />
                <style>{`
                  .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
                    transition: all 0.2s ease;
                  }
                  .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.15);
                    box-shadow: 0 3px 12px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
                  }
                  .slider::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
                    transition: all 0.2s ease;
                  }
                  .slider::-moz-range-thumb:hover {
                    transform: scale(1.15);
                    box-shadow: 0 3px 12px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
                  }
                `}</style>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span className="font-medium">1 km</span>
                <span className="font-medium">25 km</span>
                <span className="font-medium">50 km</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="btn-primary w-full text-base py-4"
            >
              {searching ? (
                <>
                  <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 inline mr-2" />
                  Search Physicians
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <p className="text-body text-sm">
              <span className="font-semibold text-blue-700">Pro tip:</span> You can search by specialty, location, physician name, or a combination. Our AI will understand your intent and find the best matches.
            </p>
          </div>
        </div>

        {/* Search Results */}
        {searchResults && (
          <div className="glass-card-strong rounded-3xl p-6 sm:p-8 mb-8 shadow-professional-lg animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {searchResults.resultsCount === 0 ? (
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                ) : (
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                )}
                <div>
                  <h2 className="text-heading text-xl sm:text-2xl">
                    {searchResults.resultsCount === 0 ? 'No Results Found' : 'Search Results'}
                  </h2>
                  {searchResults.resultsCount > 0 && (
                    <p className="text-body text-sm mt-1">
                      Showing {allResults.length} of {searchResults.resultsCount} results
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleCopyResults}
                className="btn-secondary text-sm py-2 px-4"
                title="Copy results to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 inline mr-2 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 inline mr-2" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>

            {searchResults.error ? (
              <div className="glass-card rounded-2xl p-6 border border-amber-200 bg-amber-50/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-body font-medium text-amber-900">{searchResults.error}</p>
                    {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                      <ul className="mt-3 space-y-2 text-sm text-amber-800">
                        {searchResults.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : searchResults.resultsCount === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Search className="w-full h-full" />
                </div>
                <p className="text-body font-medium">No physicians found matching your search</p>
                <p className="text-body text-sm mt-2">Try adjusting your search terms or expanding your radius</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {allResults.map((doctor, index) => (
                    <DoctorCard key={`${doctor.npi || doctor.name}-${index}`} doctor={doctor} index={index} />
                  ))}
                </div>

                {/* Load More Button */}
                {hasMoreResults && (
                  <div className="flex justify-center mt-8" ref={resultsEndRef}>
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="btn-load-more"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                          Loading More...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-5 h-5 inline mr-2" />
                          Load More Doctors
                        </>
                      )}
                    </button>
                  </div>
                )}

                {!hasMoreResults && allResults.length > 0 && (
                  <div className="text-center py-4 text-body text-sm">
                    <p>All {searchResults.resultsCount} results displayed</p>
                  </div>
                )}

                {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                  <div className="mt-6 glass-card rounded-2xl p-5 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">💡</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-subheading text-sm mb-3">How to improve your search:</h3>
                        <ul className="space-y-2 text-sm text-body">
                          {searchResults.suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setSearchResults(null);
                      setAllResults([]);
                      setCurrentPage(1);
                      setHasMoreResults(false);
                      setShowHistory(true);
                    }}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    New Search
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search History */}
        {showHistory && !searchResults && (
          <div className="animate-fade-in">
            <SearchHistory onSelectSearch={handleSelectSearch} />
          </div>
        )}
      </div>
    </div>
  );
}
