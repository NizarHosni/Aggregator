import { Clock, MapPin, Stethoscope, X, Trash2, Loader2 } from 'lucide-react';
import { useSearchHistory } from '../hooks/useSearchHistory';

interface SearchHistoryProps {
  onSelectSearch: (query: string) => void;
}

export function SearchHistory({ onSelectSearch }: SearchHistoryProps) {
  const { history, loading, deleteFromHistory, clearHistory } = useSearchHistory();

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-8 shadow-professional animate-fade-in">
        <div className="flex items-center justify-center gap-3 text-body">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="font-medium">Loading history...</span>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-12 shadow-professional animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock className="w-full h-full" />
          </div>
          <p className="text-body font-medium">No search history yet</p>
          <p className="text-body text-sm mt-2">Your searches will appear here</p>
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
    <div className="glass-card-strong rounded-3xl shadow-professional-lg animate-fade-in overflow-hidden">
      <div className="p-6 border-b border-gray-200/50 flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-heading text-lg">Recent Searches</h3>
            <p className="text-body text-xs mt-0.5">{history.length} saved search{history.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all search history?')) {
                clearHistory();
              }
            }}
            className="btn-secondary text-xs py-2 px-3 text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-3 h-3 inline mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100/50 max-h-[600px] overflow-y-auto">
        {history.map((item, index) => (
          <div
            key={item.id}
            className="p-5 hover:bg-white/50 transition-all duration-200 group cursor-pointer"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onSelectSearch(item.query)}
                className="flex-1 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-heading text-base mb-2 group-hover:text-blue-600 transition-colors">
                      {item.query}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {item.specialty && (
                        <span className="badge">
                          <Stethoscope className="w-3 h-3 inline mr-1" />
                          {item.specialty}
                        </span>
                      )}
                      {item.location && (
                        <span className="badge">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {item.location}
                        </span>
                      )}
                      <span className="text-body font-medium">{item.results_count} results</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-body">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFromHistory(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 hover:bg-red-50 rounded-lg"
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
