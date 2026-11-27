// app/modules/gallery/hooks/useGallery.ts
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export interface PhotoAsset {
  id: string;
  url: string;
  guestName: string;
  caption: string;
  tags: string[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:7071/api");

export function useGallery() {
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");

  const fetchPhotos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/get-photos`, { signal });

      if (!res.ok) {
        throw new Error(`Failed to load gallery (${res.status}).`);
      }

      const data: unknown = await res.json();
      setPhotos(Array.isArray(data) ? (data as PhotoAsset[]) : []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not load gallery photos."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPhotos(controller.signal);

    return () => controller.abort();
  }, [fetchPhotos]);

  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const photo of photos) {
      if (Array.isArray(photo.tags)) {
        for (const tag of photo.tags) {
          if (tag) tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (!activeTag) return photos;
    return photos.filter((p) => p.tags?.includes(activeTag));
  }, [photos, activeTag]);

  return {
    photos: filteredPhotos,
    totalCount: photos.length,
    uniqueTags,
    activeTag,
    setActiveTag,
    loading,
    error,
    refetch: () => fetchPhotos(),
  };
}
