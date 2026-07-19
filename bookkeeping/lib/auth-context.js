"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, signOut, getCurrentUser, isFirebaseConfigured } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(false);

  useEffect(() => {
    // Check if Firebase is configured
    const configured = isFirebaseConfigured();
    setFirebaseAvailable(configured);

    if (!configured) {
      // If Firebase is not configured, set loading to false and user to null
      setLoading(false);
      setUser(null);
      return;
    }

    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (firebaseAvailable) {
      await signOut();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, firebaseAvailable }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
