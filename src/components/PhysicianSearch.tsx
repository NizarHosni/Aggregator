import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Copy, Check, AlertCircle, Phone, MapPin, Star, Clock, ChevronDown, Loader2, ExternalLink, Heart } from 'lucide-react';
import { UserButton } from '@stackframe/stack';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFavorites } from '../hooks/useFavorites';
import { usePreferences } from '../hooks/usePreferences';
import { SearchHistory } from './SearchHistory';
import { PreferencesMenu } from './PreferencesMenu';
import { SearchResultsSkeleton } from './SkeletonLoader';
import { useSEO } from '../hooks/useSEO';
import { AppointmentBookingCard } from './AppointmentBooking';
import { ReviewScorecard } from './ReviewScorecard';
import { normalizeDoctorData, getDoctorSources, extractPracticeInfo } from '../utils/doctorUtils';

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
    acceptedInsurances?: string[];
    telehealth?: boolean;
    inPerson?: boolean;
    afterHours?: boolean;
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
    acceptedInsurances?: string[];
    telehealth?: boolean;
    inPerson?: boolean;
    afterHours?: boolean;
    googlePlaceId?: string;
    healthgradesId?: string;
    website?: string;
    practice?: { name?: string; phone?: string };
    googleData?: { business_name?: string };
    nppesData?: { practice_name?: string };
    healthgradesData?: { practice_name?: string };
  };
  index: number;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

interface DeepSearchData {
  website?: string;
  education?: string[];
  certifications?: string[];
  practiceLocations?: string[];
  reviews?: Array<{
    source: string;
    snippet: string;
  }>;
}

async function fetchDeepSearchInfo(npi?: string): Promise<DeepSearchData> {
  void npi;
  // Placeholder for future API integration
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    website: 'https://www.healthgrades.com/physician',
    education: ['Johns Hopkins School of Medicine', 'Stanford Residency Program'],
    certifications: ['American Board of Ophthalmology', 'Vitreoretinal Surgery Fellowship'],
    practiceLocations: ['Northwest Vision Center, Seattle, WA', 'Puget Sound Eye Specialists, Tacoma, WA'],
    reviews: [
      { source: 'Vitals', snippet: 'Highly attentive and thorough during exams.' },
      { source: 'Healthgrades', snippet: 'Helped me understand every step of the procedure.' },
    ],
  };
}

function DeepSearchPanel({ data }: { data: DeepSearchData }) {
  return (
    <div className="mt-4 p-4 border border-blue-100 rounded-2xl bg-blue-50/50 space-y-3">
      {data.website && (
        <p className="text-sm text-blue-700 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          <a href={data.website} target="_blank" rel="noopener noreferrer" className="underline">
            Visit official website
          </a>
        </p>
      )}
      {data.education && (
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Education</p>
          <ul className="text-sm text-body list-disc ml-4">
            {data.education.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {data.certifications && (
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Certifications</p>
          <ul className="text-sm text-body list-disc ml-4">
            {data.certifications.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {data.practiceLocations && (
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Practice Locations</p>
          <ul className="text-sm text-body list-disc ml-4">
            {data.practiceLocations.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {data.reviews && (
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Recent Feedback</p>
          <div className="space-y-2">
            {data.reviews.map((review, idx) => (
              <div key={idx} className="text-sm text-body">
                <p className="font-semibold text-gray-900">{review.source}</p>
                <p className="text-gray-600">"{review.snippet}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DoctorCard({ doctor, index, isFavorited = false, onToggleFavorite }: DoctorCardProps) {
  const navigate = useNavigate();
  const [showDeepInfo, setShowDeepInfo] = useState(false);
  const [deepSearchData, setDeepSearchData] = useState<DeepSearchData | null>(null);
  const [deepSearchLoading, setDeepSearchLoading] = useState(false);
  const [deepSearchError, setDeepSearchError] = useState<string | null>(null);
  const [favoriteAnimation, setFavoriteAnimation] = useState(false);

  // Normalize doctor data (fix typos)
  const normalizedDoctor = normalizeDoctorData(doctor);
  
  // Extract practice information
  const practiceInfo = extractPracticeInfo(doctor);
  
  // Get source links
  const sources = getDoctorSources({
    npi: doctor.npi,
    name: doctor.name,
    specialty: doctor.specialty,
    googlePlaceId: doctor.googlePlaceId,
    healthgradesId: doctor.healthgradesId,
    website: doctor.website,
  });

  const runDeepSearch = async () => {
    if (deepSearchLoading) return;
    setDeepSearchLoading(true);
    setDeepSearchError(null);
    try {
      const data = await fetchDeepSearchInfo(doctor.npi);
      setDeepSearchData(data);
      setShowDeepInfo(true);
    } catch (error) {
      console.error('Deep search error:', error);
      setDeepSearchError('Unable to fetch detailed info. Please try again later.');
    } finally {
      setDeepSearchLoading(false);
    }
  };

  const handleFavoriteClick = () => {
    if (onToggleFavorite) {
      onToggleFavorite();
      setFavoriteAnimation(true);
      setTimeout(() => setFavoriteAnimation(false), 600);
    }
  };

  return (
    <div 
      className="doctor-card animate-fade-in relative"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Favorite Button */}
      {doctor.npi && onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full transition-all duration-300 ${
            isFavorited 
              ? 'bg-pink-100 hover:bg-pink-200 text-pink-600' 
              : 'bg-white/80 hover:bg-white text-gray-400 hover:text-pink-600'
          } ${favoriteAnimation ? 'animate-bounce' : ''}`}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart 
            className={`w-5 h-5 transition-all ${isFavorited ? 'fill-pink-600' : ''}`}
          />
        </button>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {normalizedDoctor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-heading text-lg mb-1 truncate">{normalizedDoctor.name}</h3>
              <p className="text-body text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="truncate">{normalizedDoctor.specialty}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Practice Information */}
        {practiceInfo.name && (
          <div className="practice-info">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏥</span>
              <strong className="text-heading text-sm">{practiceInfo.name}</strong>
              {practiceInfo.verified && (
                <span className="text-xs text-blue-600" title="Verified by multiple sources">✓</span>
              )}
            </div>
            {practiceInfo.phone && (
              <p className="text-body text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {practiceInfo.phone}
              </p>
            )}
            {practiceInfo.type && (
              <p className="text-body text-xs text-gray-600">{practiceInfo.type}</p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 text-body text-sm">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{normalizedDoctor.location}</span>
        </div>

        <div className="flex items-center gap-2 text-body text-sm">
          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <a 
            href={`tel:${normalizedDoctor.phone}`} 
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {normalizedDoctor.phone}
          </a>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          {normalizedDoctor.rating > 0 && (
            <div className="flex items-center gap-1 badge-rating">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{normalizedDoctor.rating.toFixed(1)}</span>
            </div>
          )}
          <div className="badge-experience">
            <Clock className="w-3 h-3 inline mr-1" />
            <span>{normalizedDoctor.years_experience}+ years</span>
          </div>
        </div>

        {/* Source Links */}
        {sources.length > 0 && (
          <div className="source-links">
            <h4 className="source-links-title">🔍 Verified Sources:</h4>
            <div className="links-grid">
              {sources.map((source, sourceIndex) => (
                <a 
                  key={sourceIndex}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  <span>{source.icon}</span>
                  <span className="truncate">{source.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={runDeepSearch}
          disabled={deepSearchLoading}
          className="w-full mt-4 btn-secondary text-sm justify-center flex items-center gap-2"
        >
          {deepSearchLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gathering detailed info...
            </>
          ) : (
            <>
              <span role="img" aria-label="search">🔍</span>
              Get Detailed Info
            </>
          )}
        </button>
        {deepSearchError && (
          <p className="text-xs text-red-600 mt-2">{deepSearchError}</p>
        )}
        {showDeepInfo && deepSearchData && (
          <DeepSearchPanel data={deepSearchData} />
        )}

        {normalizedDoctor.npi && (
          <button
            onClick={() => navigate(`/doctor/${normalizedDoctor.npi}`)}
            className="w-full mt-4 btn-secondary text-sm justify-center flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Full Profile
          </button>
        )}

        <ReviewScorecard doctorNpi={normalizedDoctor.npi} />
        <AppointmentBookingCard doctor={normalizedDoctor} />
      </div>
    </div>
  );
}

function SearchGuidance() {
  return (
    <div className="search-guidance glass-card p-4 rounded-2xl border border-blue-100 space-y-3">
      <h3 className="text-subheading text-sm">How to search for doctors</h3>
      <ul className="space-y-2 text-sm text-body">
        <li>✅ <strong>Doctor Name + Location</strong> (e.g., "Dr. Smith in Seattle")</li>
        <li>✅ <strong>Doctor Name + Specialty</strong> (e.g., "Mark Nelson retina surgeon")</li>
        <li>✅ <strong>Specialty + Location</strong> (e.g., "Cardiologist Tacoma")</li>
        <li>❌ Specialty alone (needs a location)</li>
        <li>❌ Location alone (needs a specialty or doctor name)</li>
      </ul>
    </div>
  );
}

function MapIntegration({ doctors }: { doctors: SearchResult['results'] }) {
  if (!doctors.length) return null;

  return (
    <div className="map-section glass-card p-5 rounded-3xl border border-gray-100 mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-heading text-lg">Doctors in your area</h3>
          <p className="text-body text-sm">Interactive map experience coming soon</p>
        </div>
        <span className="text-sm font-semibold text-blue-600">{doctors.length} markers</span>
      </div>
      <div className="map-placeholder rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center text-body text-sm">
        📍 Preview coordinates will appear here once the interactive map is live.
      </div>
      <button className="view-map-btn btn-secondary w-full mt-4">
        📍 View on Interactive Map (Beta)
      </button>
    </div>
  );
}

const DEFAULT_RADIUS_METERS = 25000;

export function PhysicianSearch() {
  const navigate = useNavigate();
  const { addToHistory, saveSearchResults, getSearchResults, refreshHistory } = useSearchHistory();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { preferences } = usePreferences();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [allResults, setAllResults] = useState<SearchResult['results']>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [currentSearchLocation, setCurrentSearchLocation] = useState('');
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
      const radiusInMeters = preferences.searchRadius || DEFAULT_RADIUS_METERS;
      const trimmedQuery = query.trim();
      const results = await searchApi.searchPhysicians(trimmedQuery, radiusInMeters, page, preferences.resultsPerPage || 15);

      if (page === 1) {
        // First page - replace results
        setSearchResults(results);
        setAllResults(results.results);
        setCurrentPage(1);
        setHasMoreResults(results.pagination?.hasMore || false);
        setCurrentSearchQuery(results.query);
        setCurrentSearchLocation(getLocationText(results.location));

        // Save to history with timestamp as ID
        const historyId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await addToHistory(
          results.query,
          results.specialty,
          getLocationText(results.location),
          results.resultsCount
        );

        // Refresh history to get the new item
        refreshHistory();
        
        // Small delay to ensure localStorage is updated
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Save full results to localStorage
        saveSearchResults(historyId, {
          query: results.query,
          specialty: results.specialty,
          location: results.location,
          results: results.results,
          resultsCount: results.resultsCount,
          searchRadius: results.searchRadius,
          pagination: results.pagination,
          timestamp: new Date().toISOString(),
        });
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
    } catch (error) {
      const err = error as Error & { message?: string; status?: number; code?: string };
      console.error('Search error:', err);
      
      let errorMessage = 'Search failed. Please try again.';

      const message = err.message || '';
      if (message.includes('quota') || message.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. The search will use fallback results, but they may be limited. Please check your OpenAI account billing.';
      } else if (message) {
        errorMessage = message;
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
      const radiusInMeters = preferences.searchRadius || DEFAULT_RADIUS_METERS;
      const results = await searchApi.searchPhysicians(searchResults.query, radiusInMeters, nextPage, preferences.resultsPerPage || 15);

      setAllResults(prev => [...prev, ...results.results]);
      setCurrentPage(nextPage);
      setHasMoreResults(results.pagination?.hasMore || false);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setLoadingMore(false);
    }
    
    // Smooth scroll to new results after a brief delay
    setTimeout(() => {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  const handleSelectSearch = async (historyItem: { id: string; query: string }) => {
    setLoadingHistoryId(historyItem.id);
    setShowHistory(false);
    
    // Brief delay for better UX
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      // Try to restore results from localStorage
      const storedResults = getSearchResults(historyItem.id);
      
      if (storedResults) {
        // Restore the exact results from history
        setSearchResults({
          query: storedResults.query,
          specialty: storedResults.specialty,
          location: storedResults.location,
          results: storedResults.results,
          resultsCount: storedResults.resultsCount,
          searchRadius: storedResults.searchRadius,
          pagination: storedResults.pagination,
        });
        setAllResults(storedResults.results);
        setCurrentPage(storedResults.pagination?.currentPage || 1);
        setHasMoreResults(storedResults.pagination?.hasMore || false);
        setQuery(storedResults.query);
        setCurrentSearchQuery(storedResults.query);
        setCurrentSearchLocation(getLocationText(storedResults.location));
        
        // Scroll to results
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } else {
        // Fallback: if results not found, just set query and let user search again
        setQuery(historyItem.query);
        setCurrentSearchQuery(historyItem.query);
        setCurrentSearchLocation('');
        setSearchResults(null);
        setAllResults([]);
        setCurrentPage(1);
        setHasMoreResults(false);
      }
    } catch (error) {
      console.error('Error restoring search from history:', error);
      // Fallback to just setting the query
      setQuery(historyItem.query);
      setSearchResults(null);
      setAllResults([]);
      setCurrentPage(1);
      setHasMoreResults(false);
    } finally {
      setLoadingHistoryId(null);
    }
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/favorites')}
                className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Favorites</span>
              </button>
              <PreferencesMenu />
              <UserButton />
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
              <input
                id="search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "Retina Surgeons in Tacoma" or "Dr. Smith Orthopedic Kansas City"'
                className="search-input text-base"
                disabled={searching}
              />
            </div>

            <SearchGuidance />

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

        {/* Loading State - Show Skeletons */}
        {searching && !searchResults && (
          <div className="glass-card-strong rounded-3xl p-6 sm:p-8 mb-8 shadow-professional-lg animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <h2 className="text-heading text-xl sm:text-2xl">Searching...</h2>
            </div>
            <SearchResultsSkeleton />
          </div>
        )}

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

            {searchResults.resultsCount > 0 && (
              <div className="results-summary mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex flex-wrap gap-4 text-sm text-body">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Search query</p>
                  <p className="text-heading">{currentSearchQuery || searchResults.query}</p>
                </div>
                {currentSearchLocation && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Location</p>
                    <p className="text-heading">{currentSearchLocation}</p>
                  </div>
                )}
              </div>
            )}

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
                    <DoctorCard 
                      key={`${doctor.npi || doctor.name}-${index}`} 
                      doctor={doctor} 
                      index={index}
                      isFavorited={doctor.npi ? isFavorited(doctor.npi) : false}
                      onToggleFavorite={doctor.npi ? async () => {
                        await toggleFavorite({
                          npi: doctor.npi!,
                          name: doctor.name,
                          specialty: doctor.specialty,
                          location: doctor.location,
                          phone: doctor.phone,
                          rating: doctor.rating,
                          years_experience: doctor.years_experience,
                        });
                      } : undefined}
                    />
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

                <MapIntegration doctors={allResults} />

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
                      setCurrentSearchQuery('');
                      setCurrentSearchLocation('');
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
            <SearchHistory 
              onSelectSearch={handleSelectSearch} 
              loadingHistoryId={loadingHistoryId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
