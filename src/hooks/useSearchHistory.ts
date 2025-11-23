import { useState, useEffect } from 'react';
import { historyApi, SearchHistory } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// LocalStorage key prefix for storing search results
const RESULTS_STORAGE_PREFIX = 'doctor_search_results_';

// Interface for stored search results
interface StoredSearchResult {
  query: string;
  specialty: string;
  location: string | null;
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
  searchRadius?: number | null;
  pagination?: {
    currentPage: number;
    resultsPerPage: number;
    totalPages: number;
    hasMore: boolean;
    totalResults: number;
  };
  timestamp: string;
}

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

  // Save search results to localStorage
  const saveSearchResults = (historyId: string, results: StoredSearchResult) => {
    try {
      const key = `${RESULTS_STORAGE_PREFIX}${historyId}`;
      localStorage.setItem(key, JSON.stringify(results));
      
      // Clean up old results (keep only last 20)
      cleanupOldResults();
    } catch (error) {
      console.error('Error saving search results to localStorage:', error);
    }
  };

  // Retrieve search results from localStorage
  const getSearchResults = (historyId: string): StoredSearchResult | null => {
    try {
      const key = `${RESULTS_STORAGE_PREFIX}${historyId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error retrieving search results from localStorage:', error);
    }
    return null;
  };

  // Clean up old results (keep only last 20)
  const cleanupOldResults = () => {
    try {
      const allKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(RESULTS_STORAGE_PREFIX))
        .map(key => ({
          key,
          timestamp: JSON.parse(localStorage.getItem(key) || '{}').timestamp || '0'
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      
      // Keep only last 20, remove the rest
      const keysToRemove = allKeys.slice(20);
      keysToRemove.forEach(({ key }) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error cleaning up old results:', error);
    }
  };

  // Delete results when history item is deleted
  const deleteSearchResults = (historyId: string) => {
    try {
      const key = `${RESULTS_STORAGE_PREFIX}${historyId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error deleting search results from localStorage:', error);
    }
  };

  const addToHistory = async (
    _query: string,
    _specialty: string | null,
    _location: string | null,
    _resultsCount: number
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
      // Also delete stored results from localStorage
      deleteSearchResults(id);
    } catch (error) {
      console.error('Error deleting from search history:', error);
    }
  };

  const clearHistory = async () => {
    if (!user) return;

    try {
      await historyApi.clearHistory();
      setHistory([]);
      // Clear all stored results from localStorage
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith(RESULTS_STORAGE_PREFIX)
        );
        keys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.error('Error clearing localStorage results:', error);
      }
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  return {
    history,
    loading,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    refreshHistory: fetchHistory,
    saveSearchResults,
    getSearchResults,
    deleteSearchResults,
  };
}
