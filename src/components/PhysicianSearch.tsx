import { useState } from 'react';
import { Search, LogOut, User, Stethoscope, Copy, Check, AlertCircle } from 'lucide-react';
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
  }>;
  resultsCount: number;
  error?: string | null;
  suggestions?: string[] | null;
  searchRadius?: number | null;
}

export function PhysicianSearch() {
  const { user, signOut } = useAuth();
  const { addToHistory } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // Default 5km
  const [searching, setSearching] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [copied, setCopied] = useState(false);

  // SEO optimization - update meta tags
  useSEO({
    title: 'Find Doctors Near You - Real Phone Numbers & Reviews | YoDoc',
    description: 'Find real doctors with phone numbers, addresses, and ratings. Search by name, specialty, and location. Contact healthcare providers directly. Verified US healthcare provider database.',
    keywords: 'find doctors, doctor search, physicians near me, healthcare providers, doctor phone numbers, medical specialists, find doctors near me, doctor directory, physician directory',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setShowHistory(false);

    try {
      const { searchApi } = await import('../lib/api');
      const radiusInMeters = searchRadius * 1000; // Convert km to meters
      const results = await searchApi.searchPhysicians(query, radiusInMeters);

      // Refresh history (it's automatically saved by the API)
      await addToHistory(
        results.query,
        results.specialty,
        getLocationText(results.location),
        results.resultsCount
      );

      // Store results for display
      setSearchResults(results);
      setQuery('');
      setShowHistory(false);
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Handle specific error cases
      let errorMessage = 'Search failed. Please try again.';
      
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. The search will use fallback results, but they may be limited. Please check your OpenAI account billing.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Display error as a result-like message
      setSearchResults({
        query: query,
        specialty: 'Unknown',
        location: null,
        results: [],
        resultsCount: 0,
        error: errorMessage,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setShowHistory(false);
    setSearchResults(null);
  };

  // Helper function to get location text
  const getLocationText = (location: SearchResult['location']): string => {
    if (!location) return 'Not specified';
    if (typeof location === 'string') return location;
    return location.formatted_address || 'Not specified';
  };

  const formatResultsText = (results: SearchResult): string => {
    if (results.error) {
      let errorText = `Search Error: ${results.error}

Search Query: "${results.query}"

Search Details:
- Specialty: ${results.specialty}
- Location: ${getLocationText(results.location) || 'Not specified'}`;

      if (results.suggestions && results.suggestions.length > 0) {
        errorText += `\n\nSuggestions:\n${results.suggestions.map(s => `• ${s}`).join('\n')}`;
      } else {
        errorText += `\n\nPlease try again or contact support if the issue persists.`;
      }

      return errorText;
    }

    if (results.resultsCount === 0) {
      const locationText = getLocationText(results.location) || 'Not specified';
      const radiusText = results.searchRadius ? ` (within ${results.searchRadius / 1000}km radius)` : '';
      
      let noResultsText = `No physicians found matching "${results.query}"

Search Parameters:
- Specialty: ${results.specialty}
- Location: ${locationText}${radiusText}`;

      // Don't include suggestions in the text - they'll be shown in the suggestions box below
      // Just add a note that suggestions are available
      if (results.suggestions && results.suggestions.length > 0) {
        noResultsText += `\n\nPlease see suggestions below to refine your search.`;
      }

      return noResultsText;
    }

    const resultsText = results.results
      .map((p, i) => `${i + 1}. ${p.name} - ${p.specialty}\n   ${p.location} | ${p.phone} | ⭐ ${p.rating}/5`)
      .join('\n\n');

    const locationText = getLocationText(results.location);

    return `Found ${results.resultsCount} physician${results.resultsCount !== 1 ? 's' : ''} matching "${results.query}"

Search Details:
- Specialty: ${results.specialty}
- Location: ${locationText}

Results:

${resultsText}`;
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-2 rounded-xl">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Find Real Doctors With Phone Numbers & Reviews
                </h1>
                <p className="text-sm text-gray-600">
                  Search verified US healthcare providers by name, specialty, or location
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Search by Name, Specialty, or Location</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={searching}
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="radius" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Search Radius
                </label>
                <span className="text-lg font-bold text-blue-600 bg-white px-3 py-1 rounded-lg shadow-sm">
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
                    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
                    transition: all 0.2s ease;
                  }
                  .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 3px 8px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
                  }
                  .slider::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
                    transition: all 0.2s ease;
                  }
                  .slider::-moz-range-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 3px 8px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
                  }
                `}</style>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span className="font-medium">1 km</span>
                <span className="font-medium">25 km</span>
                <span className="font-medium">50 km</span>
              </div>
              {searchResults && searchResults.searchRadius && (
                <div className="mt-3 p-2 bg-white rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-blue-500">📍</span>
                    Last search used <span className="font-semibold text-blue-600">{searchResults.searchRadius / 1000} km</span> radius
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-600 mt-3 flex items-center gap-1">
                <span className="text-blue-500">💡</span>
                Adjust the radius to search a wider or narrower area. Click "Search Physicians" to apply.
              </p>
            </div>

            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search Physicians
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Pro tip:</span> You can search by specialty, location, physician name, or a combination. Our AI will understand your intent and find the best matches.
            </p>
          </div>
        </div>

        {/* SEO-Friendly Content Section */}
        <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Find Doctors Near You - Verified Healthcare Providers</h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            <p className="mb-4">
              Search our comprehensive directory of verified US healthcare providers. Find doctors with real phone numbers, addresses, and contact information. Our database includes physicians from the official NPPES (National Plan and Provider Enumeration System) registry, ensuring you get accurate, up-to-date information.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">How to Search for Doctors</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Search by Name:</strong> Enter a doctor's name (e.g., "Dr. John Smith")</li>
              <li><strong>Search by Specialty:</strong> Find specialists by type (e.g., "Cardiologists in Houston, TX")</li>
              <li><strong>Search by Location:</strong> Discover doctors near you (e.g., "Doctors in Los Angeles, CA")</li>
              <li><strong>Combined Search:</strong> Combine name, specialty, and location for precise results</li>
            </ul>
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Popular Medical Specialties</h3>
            <p className="mb-2">
              Find specialists in: Cardiology, Orthopedic Surgery, Dermatology, Neurology, Pediatrics, Ophthalmology, Retina Surgery, Primary Care, and more.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Major Cities We Cover</h3>
            <p className="mb-2">
              Search for doctors in major US cities including: Los Angeles, New York, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Jose, and many more locations across the United States.
            </p>
          </div>
        </div>

        {searchResults && (
          <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {searchResults.resultsCount === 0 ? (
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                ) : (
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                )}
                <h2 className="text-xl font-bold text-gray-900">
                  {searchResults.resultsCount === 0 ? 'No Results Found' : 'Search Results'}
                </h2>
              </div>
              <button
                onClick={handleCopyResults}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                title="Copy results to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                {formatResultsText(searchResults)}
              </pre>
            </div>

            {searchResults.suggestions && searchResults.suggestions.length > 0 && (
              <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">💡</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">How to improve your search:</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
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

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setSearchResults(null);
                  setShowHistory(true);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
              >
                New Search
              </button>
            </div>
          </div>
        )}

        {showHistory && !searchResults && <SearchHistory onSelectSearch={handleSelectSearch} />}
      </div>
    </div>
  );
}
