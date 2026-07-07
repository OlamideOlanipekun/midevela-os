"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  fullName: string;
  email: string;
}

interface MockAuthContextType {
  isSignedIn: boolean;
  user: User | null;
  signIn: (email: string) => void;
  signOut: () => void;
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Read mock auth state from cookies
    const cookieHeader = document.cookie || '';
    const isAuthed = cookieHeader.includes('midevela_mock_auth=true');
    setIsSignedIn(isAuthed);
    if (isAuthed) {
      setUser({ fullName: 'Adaeze Okonkwo', email: 'adaeze@lumina.com' });
    }
  }, []);

  const signIn = (email: string) => {
    document.cookie = 'midevela_mock_auth=true; path=/; max-age=86400';
    setIsSignedIn(true);
    setUser({ fullName: 'Adaeze Okonkwo', email });
  };

  const signOut = () => {
    document.cookie = 'midevela_mock_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    setIsSignedIn(false);
    setUser(null);
    router.push('/login');
  };

  return (
    <MockAuthContext.Provider value={{ isSignedIn, user, signIn, signOut }}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
}
