// app/modules/registry/hooks/useRegistry.ts
"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";

export interface RegistryItem {
  id: string;
  title: string;
  originalPrice: number;
  originalStore: string;
  originalRegistryUrl: string;
  bestAlternativePrice: number;
  cheaperMerchant: string;
  dealFound: boolean;
  couponCode: string | null;
  savingsAmount: number;
  color: string | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:7071/api");

export function useRegistry() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Link Ingestion States
  const [inputUrl, setInputUrl] = useState<string>("");
  const [inputStore, setInputStore] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>("");

  const fetchControllerRef = useRef<AbortController | null>(null);

  const fetchRegistry = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/get-registry`, { signal });

      if (!res.ok) {
        throw new Error(`Could not load registry items (${res.status}).`);
      }

      const data: unknown = await res.json();
      setItems(Array.isArray(data) ? (data as RegistryItem[]) : []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not load registry items."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    fetchRegistry(controller.signal);

    return () => controller.abort();
  }, [fetchRegistry]);

  const syncRegistryLink = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmedUrl = inputUrl.trim();
      const trimmedStore = inputStore.trim();
      if (!trimmedUrl || !trimmedStore || syncing) return;

      setSyncing(true);
      setSyncError("");

      try {
        const res = await fetch(`${API_BASE}/sync-registry-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl, storeName: trimmedStore }),
        });

        if (!res.ok) {
          let serverError = `Server processing fault (${res.status}).`;
          try {
            const errPayload: unknown = await res.json();
            if (
              errPayload &&
              typeof errPayload === "object" &&
              "error" in errPayload &&
              typeof errPayload.error === "string"
            ) {
              serverError = errPayload.error;
            }
          } catch {
            // Fall back to HTTP status error if response body is not JSON
          }
          throw new Error(serverError);
        }

        setInputUrl("");
        setInputStore("");

        // Refresh the registry list cleanly
        fetchControllerRef.current?.abort();
        const refreshController = new AbortController();
        fetchControllerRef.current = refreshController;
        await fetchRegistry(refreshController.signal);
      } catch (err: unknown) {
        setSyncError(
          err instanceof Error
            ? `Ingestion Error: ${err.message}`
            : "Ingestion Error: Unable to sync registry link."
        );
      } finally {
        setSyncing(false);
      }
    },
    [inputUrl, inputStore, syncing, fetchRegistry]
  );

  return {
    items,
    loading,
    error,
    inputUrl,
    setInputUrl,
    inputStore,
    setInputStore,
    syncing,
    syncError,
    syncRegistryLink,
    refetch: () => fetchRegistry(),
  };
}
