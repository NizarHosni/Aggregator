import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { historyApi, type SearchHistoryItem } from '../lib/api';

interface StoredSearchResults {
  query: string;
  specialty: string;
  location: any;
  results: any[];
  resultsCount: number;
  searchRadius?: number | null;
  pagination?: any;
  timestamp: string;
}

const HISTORY_KEY = 'yodoc_search_history';
const RESULTS_KEY_PREFIX = 'yodoc_search_results_';
const MAX_HISTORY_ITEMS = 50;

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load history from database (if logged in) or localStorage (if guest)
  const loadHistory = async () => {
    try {
      if (user) {
        // Load from database
        const dbHistory = await historyApi.getHistory();
        setHistory(dbHistory);
        
        // Merge with localStorage (for any items added before login)
        try {
          const localStored = localStorage.getItem(HISTORY_KEY);
          if (localStored) {
            const localHistory = JSON.parse(localStored) as SearchHistoryItem[];
            // Sync local items to database
            for (const item of localHistory) {
              await historyApi.addHistory(item.query, item.specialty, item.location, item.results_count);
            }
            // Clear localStorage after sync
            localStorage.removeItem(HISTORY_KEY);
          }
        } catch (error) {
          console.warn('Error syncing local history:', error);
        }
      } else {
        // Load from localStorage for guest users
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as SearchHistoryItem[];
          setHistory(parsed);
        } else {
          setHistory([]);
        }
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as SearchHistoryItem[];
          setHistory(parsed);
        } else {
          setHistory([]);
        }
      } catch {
        setHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Save history to localStorage
  const saveHistory = (newHistory: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  // Add new search to history
  const addToHistory = async (
    query: string,
    specialty: string,
    location: string,
    resultsCount: number
  ) => {
    const newItem: SearchHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      specialty: specialty || null,
      location: location || null,
      results_count: resultsCount,
      created_at: new Date().toISOString(),
    };

    if (user) {
      // Save to database
      try {
        const dbItem = await historyApi.addHistory(query, specialty || null, location || null, resultsCount);
        if (dbItem) {
          const updatedHistory = [dbItem, ...history].slice(0, MAX_HISTORY_ITEMS);
          setHistory(updatedHistory);
          return;
        }
      } catch (error) {
        console.warn('Failed to save to database, using localStorage:', error);
      }
    }

    // Fallback to localStorage
    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    saveHistory(updatedHistory);
  };

  // Delete item from history
  const deleteFromHistory = async (id: string) => {
    // Also delete stored results
    try {
      localStorage.removeItem(`${RESULTS_KEY_PREFIX}${id}`);
    } catch (error) {
      console.error('Error deleting stored results:', error);
    }

    if (user) {
      // Delete from database
      try {
        await historyApi.deleteHistoryItem(id);
      } catch (error) {
        console.warn('Failed to delete from database:', error);
      }
    }

    const updatedHistory = history.filter(item => item.id !== id);
    saveHistory(updatedHistory);
  };

  // Clear all history
  const clearHistory = async () => {
    if (user) {
      // Clear from database
      try {
        await historyApi.clearHistory();
      } catch (error) {
        console.warn('Failed to clear database history:', error);
      }
    }

    // Clear all stored results
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(RESULTS_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing stored results:', error);
    }

    saveHistory([]);
  };

  // Save search results to localStorage
  const saveSearchResults = (historyId: string, results: StoredSearchResults) => {
    try {
      localStorage.setItem(
        `${RESULTS_KEY_PREFIX}${historyId}`,
        JSON.stringify(results)
      );
    } catch (error) {
      console.error('Error saving search results:', error);
    }
  };

  // Get search results from localStorage
  const getSearchResults = (historyId: string): StoredSearchResults | null => {
    try {
      const stored = localStorage.getItem(`${RESULTS_KEY_PREFIX}${historyId}`);
      if (stored) {
        return JSON.parse(stored) as StoredSearchResults;
      }
    } catch (error) {
      console.error('Error loading search results:', error);
    }
    return null;
  };

  // Refresh history
  const refreshHistory = () => {
    loadHistory();
  };

  useEffect(() => {
    loadHistory();
  }, [user]); // Reload when user changes

  // Ensure history is saved to localStorage even if database save fails
  useEffect(() => {
    if (history.length > 0 && !user) {
      // For guest users, ensure localStorage is always updated
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch (error) {
        console.error('Error saving history to localStorage:', error);
      }
    }
  }, [history, user]);

  return {
    history,
    loading,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    saveSearchResults,
    getSearchResults,
    refreshHistory,
  };
}

