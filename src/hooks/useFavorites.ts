import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { favoritesApi, type FavoriteDoctor } from '../lib/api';

const FAVORITES_KEY = 'yodoc_favorite_doctors';
const MAX_FAVORITES = 100;

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load favorites from database (if logged in) or localStorage (if guest)
  const loadFavorites = async () => {
    try {
      if (user) {
        // Load from database
        const dbFavorites = await favoritesApi.getFavorites();
        setFavorites(dbFavorites);
        
        // Merge with localStorage (for any items added before login)
        try {
          const localStored = localStorage.getItem(FAVORITES_KEY);
          if (localStored) {
            const localFavorites = JSON.parse(localStored) as FavoriteDoctor[];
            // Sync local items to database
            for (const fav of localFavorites) {
              await favoritesApi.addFavorite(fav);
            }
            // Clear localStorage after sync
            localStorage.removeItem(FAVORITES_KEY);
          }
        } catch (error) {
          console.warn('Error syncing local favorites:', error);
        }
      } else {
        // Load from localStorage for guest users
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as FavoriteDoctor[];
          setFavorites(parsed);
        } else {
          setFavorites([]);
        }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as FavoriteDoctor[];
          setFavorites(parsed);
        } else {
          setFavorites([]);
        }
      } catch {
        setFavorites([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Save favorites to localStorage
  const saveFavorites = (newFavorites: FavoriteDoctor[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  // Check if doctor is favorited
  const isFavorited = (npi: string): boolean => {
    return favorites.some(fav => fav.npi === npi);
  };

  // Add doctor to favorites
  const addFavorite = async (doctor: Omit<FavoriteDoctor, 'created_at' | 'id'>): Promise<boolean> => {
    if (!doctor.npi) {
      console.warn('Cannot favorite doctor without NPI');
      return false;
    }

    if (isFavorited(doctor.npi)) {
      console.log('Doctor already in favorites');
      return false;
    }

    const newFavorite: FavoriteDoctor = {
      ...doctor,
    };

    if (user) {
      // Save to database
      try {
        const dbFavorite = await favoritesApi.addFavorite(newFavorite);
        if (dbFavorite) {
          const updatedFavorites = [dbFavorite, ...favorites].slice(0, MAX_FAVORITES);
          setFavorites(updatedFavorites);
          return true;
        }
      } catch (error) {
        console.warn('Failed to save to database, using localStorage:', error);
      }
    }

    // Fallback to localStorage
    const updatedFavorites = [newFavorite, ...favorites].slice(0, MAX_FAVORITES);
    saveFavorites(updatedFavorites);
    return true;
  };

  // Remove doctor from favorites
  const removeFavorite = async (npi: string): Promise<boolean> => {
    if (!isFavorited(npi)) {
      return false;
    }

    if (user) {
      // Delete from database
      try {
        await favoritesApi.removeFavorite(npi);
      } catch (error) {
        console.warn('Failed to delete from database:', error);
      }
    }

    const updatedFavorites = favorites.filter(fav => fav.npi !== npi);
    saveFavorites(updatedFavorites);
    return true;
  };

  // Toggle favorite status
  const toggleFavorite = async (doctor: Omit<FavoriteDoctor, 'created_at' | 'id'>): Promise<boolean> => {
    if (isFavorited(doctor.npi)) {
      return await removeFavorite(doctor.npi);
    } else {
      return await addFavorite(doctor);
    }
  };

  // Clear all favorites
  const clearFavorites = () => {
    saveFavorites([]);
  };

  // Get favorite by NPI
  const getFavorite = (npi: string): FavoriteDoctor | null => {
    return favorites.find(fav => fav.npi === npi) || null;
  };

  useEffect(() => {
    loadFavorites();
  }, [user]); // Reload when user changes

  // Ensure favorites are saved to localStorage even if database save fails
  useEffect(() => {
    if (favorites.length > 0 && !user) {
      // For guest users, ensure localStorage is always updated
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error('Error saving favorites to localStorage:', error);
      }
    }
  }, [favorites, user]);

  return {
    favorites,
    loading,
    isFavorited,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    getFavorite,
  };
}

