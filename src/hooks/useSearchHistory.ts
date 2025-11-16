import { useState, useEffect } from 'react';
import { historyApi, SearchHistory } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function useSearchHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await historyApi.getHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching search history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [user]);

  const addToHistory = async (
    query: string,
    specialty: string | null,
    location: string | null,
    resultsCount: number
  ) => {
    // History is now automatically saved by the search API
    // Just refresh the history list
    await fetchHistory();
  };

  const deleteFromHistory = async (id: string) => {
    if (!user) return;

    try {
      await historyApi.deleteHistoryItem(id);
      setHistory(history.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error deleting from search history:', error);
    }
  };

  const clearHistory = async () => {
    if (!user) return;

    try {
      await historyApi.clearHistory();
      setHistory([]);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  };

  return {
    history,
    loading,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    refreshHistory: fetchHistory,
  };
}
