"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Subscription {
  plan: 'starter' | 'growth' | 'pro';
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  gracePeriodDaysRemaining: number;
  trialEndsAt: string;
  currentPeriodEnd: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isReadOnly: boolean;
  isLocked: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/workspace/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const isReadOnly = subscription?.status === 'past_due';
  const isLocked = subscription 
    ? ['expired', 'cancelled'].includes(subscription.status)
    : false;

  return (
    <SubscriptionContext.Provider 
      value={{ 
        subscription, 
        loading, 
        isReadOnly, 
        isLocked, 
        refresh: fetchSubscription 
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
