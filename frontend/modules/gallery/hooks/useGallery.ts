// modules/gallery/hooks/useGallery.ts
"use client";

import { useState, useEffect } from "react";

export interface PhotoAsset {
  id: string;
  url: string;
  guestName: string;
  caption: string;
  tags: string[];
}

export function useGallery() {
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL  || "http://localhost:7071/api";

  useEffect(() => {
    fetch(`${API_BASE}/get-photos`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not pull gallery manifest payload.");
        return res.json();
      })
      .then((data: PhotoAsset[]) => setPhotos(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredPhotos = activeTag
    ? photos.filter((p) => p.tags?.includes(activeTag))
    : photos;

  const uniqueTags = Array.from(new Set(photos.flatMap((p) => p.tags || [])));

  return { 
    photos: filteredPhotos, 
    uniqueTags, 
    activeTag, 
    setActiveTag, 
    loading, 
    error 
  };
}
