import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { localStorageService } from '../lib/localStorage';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signIn: (voiceName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const currentUser = localStorageService.getCurrentUser();
    setUser(currentUser);
  };

  const signIn = async (voiceName: string): Promise<boolean> => {
    const user = localStorageService.getUserByVoiceName(voiceName);
    if (user) {
      localStorageService.setCurrentUser(user);
      setUser(user);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const initAuth = () => {
      const currentUser = localStorageService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };

    initAuth();
  }, []);

  const signOut = async () => {
    localStorageService.clearCurrentUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser, signIn }}>
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
