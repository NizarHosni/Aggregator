import { useState, useEffect } from 'react';

export interface UserPreferences {
  darkMode: boolean;
  searchRadius: number; // in meters
  resultsPerPage: number;
}

const PREFERENCES_KEY = 'yodoc_user_preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: false,
  searchRadius: 25000, // 25km default
  resultsPerPage: 15,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage
  const loadPreferences = () => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserPreferences>;
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...parsed,
        });
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setLoading(false);
    }
  };

  // Save preferences to localStorage
  const savePreferences = (newPreferences: UserPreferences) => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
      
      // Apply dark mode immediately
      applyDarkMode(newPreferences.darkMode);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Apply dark mode to document
  const applyDarkMode = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Update individual preference
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    savePreferences(updated);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    updatePreference('darkMode', !preferences.darkMode);
  };

  // Set search radius
  const setSearchRadius = (radius: number) => {
    updatePreference('searchRadius', radius);
  };

  // Set results per page
  const setResultsPerPage = (count: number) => {
    updatePreference('resultsPerPage', count);
  };

  // Reset to defaults
  const resetPreferences = () => {
    savePreferences(DEFAULT_PREFERENCES);
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  // Apply dark mode on mount
  useEffect(() => {
    applyDarkMode(preferences.darkMode);
  }, [preferences.darkMode]);

  return {
    preferences,
    loading,
    toggleDarkMode,
    setSearchRadius,
    setResultsPerPage,
    updatePreference,
    resetPreferences,
  };
}

