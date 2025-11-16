import { Clock, MapPin, Stethoscope, X, Trash2 } from 'lucide-react';
import { useSearchHistory } from '../hooks/useSearchHistory';

interface SearchHistoryProps {
  onSelectSearch: (query: string) => void;
}

export function SearchHistory({ onSelectSearch }: SearchHistoryProps) {
  const { history, loading, deleteFromHistory, clearHistory } = useSearchHistory();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-5 h-5 animate-spin" />
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm">No search history yet</p>
          <p className="text-xs mt-1">Your searches will appear here</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Recent Searches</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {history.length}
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all search history?')) {
                clearHistory();
              }
            }}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {history.map((item) => (
          <div
            key={item.id}
            className="p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onSelectSearch(item.query)}
                className="flex-1 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {item.query}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {item.specialty && (
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />
                          {item.specialty}
                        </span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </span>
                      )}
                      <span className="text-gray-400">•</span>
                      <span>{item.results_count} results</span>
                      <span className="text-gray-400">•</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => deleteFromHistory(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                aria-label="Delete"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
