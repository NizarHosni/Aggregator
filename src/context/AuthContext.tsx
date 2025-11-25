import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in - DON'T BLOCK APP LOADING
    const checkAuth = async () => {
      try {
        // Set loading to false quickly to not block app
        setLoading(false);
        
        // Check auth in background (non-blocking)
        const currentUser = await authApi.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        // NEVER THROW - just log and continue
        console.warn('Auth check failed (non-blocking):', error);
        setUser(null);
      }
    };

    // Don't wait for auth - set loading to false immediately
    setLoading(false);
    
    // Check auth in background
    void checkAuth();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { user, error } = await authApi.signUp(email, password);
      if (error) {
        return { error };
      }
      setUser(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user, error } = await authApi.signIn(email, password);
      if (error) {
        return { error };
      }
      setUser(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    authApi.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
