import { useState } from 'react';
import { Search, LogOut, User, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { SearchHistory } from './SearchHistory';

export function PhysicianSearch() {
  const { user, signOut } = useAuth();
  const { addToHistory } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setShowHistory(false);

    try {
      const { searchApi } = await import('../lib/api');
      const results = await searchApi.searchPhysicians(query);

      // Refresh history (it's automatically saved by the API)
      await addToHistory(
        results.query,
        results.specialty,
        typeof results.location === 'string' ? results.location : results.location?.formatted_address || null,
        results.resultsCount
      );

      // Display results
      const resultsText = results.results
        .map((p, i) => `${i + 1}. ${p.name} - ${p.specialty}\n   ${p.location} | ${p.phone} | ⭐ ${p.rating}/5`)
        .join('\n\n');

      alert(`Found ${results.resultsCount} physicians matching "${query}":\n\n${resultsText}`);

      setQuery('');
      setShowHistory(true);
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Handle specific error cases
      let errorMessage = 'Search failed. Please try again.';
      
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. The search will use fallback results, but they may be limited. Please check your OpenAI account billing.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setShowHistory(false);
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
                  AI Physician Search
                </h1>
                <p className="text-sm text-gray-600">
                  Find the right physician for your needs
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

        {showHistory && <SearchHistory onSelectSearch={handleSelectSearch} />}
      </div>
    </div>
  );
}
