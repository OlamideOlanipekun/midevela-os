"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardSummary } from "./types";
import { apiRequest } from "@/lib/api/request";

interface UseDashboardReturn {
  data: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdated: Date | null;
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest<DashboardSummary>("/api/dashboard");
      if (res.ok) setData(res.data);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, lastUpdated };
}
