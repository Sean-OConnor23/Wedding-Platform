"use client";

import { useState, useEffect } from "react";

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

export function useRegistry() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  
  // Link Ingestion States
  const [inputUrl, setInputUrl] = useState<string>("");
  const [inputStore, setInputStore] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL  || "http://localhost:7071/api";

  const fetchRegistry = () => {
    setLoading(true);
    fetch("http://localhost:7071/api/get-registry")
      .then((res) => {
        if (!res.ok) throw new Error("Could not pull registry manifest parameters.");
        return res.json();
      })
      .then((data: RegistryItem[]) => setItems(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRegistry();
  }, []);

  const syncRegistryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl || !inputStore) return;

    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync-registry-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl, storeName: inputStore }),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || "Server processing fault.");
      }
      
      setInputUrl("");
      setInputStore("");
      fetchRegistry(); // Instantly refresh the cards list view
    } catch (err: any) {
      alert(`❌ Ingestion Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return { 
    items, 
    loading, 
    error, 
    inputUrl, 
    setInputUrl, 
    inputStore, 
    setInputStore, 
    syncing, 
    syncRegistryLink 
  };
}
