// modules/gallery/views/GalleryView.tsx
"use client";

import React, { useState } from "react";
import { useGallery, PhotoAsset } from "../hooks/useGallery";

export function GalleryView() {
  const { photos, uniqueTags, activeTag, setActiveTag, loading, error } = useGallery();
  // New modal asset tracker state initialization
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoAsset | null>(null);

  if (loading) {
    return <div className="text-center py-8 text-xs text-stone-400">Syncing live wedding photo stream...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-xs text-rose-500">Failed to render media assets: {error}</div>;
  }

  return (
    <div className="p-8 bg-white border border-stone-200 rounded-xl shadow-sm space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-serif text-stone-700">📸 Guest Photo Gallery</h2>
        <p className="text-xs text-stone-400">Captured live moments categorized automatically by Azure AI Vision</p>
      </div>

      {/* Dynamic AI Filter Tags Toolbar */}
      {uniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          <button
            onClick={() => setActiveTag("")}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${
              activeTag === "" ? "bg-stone-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All Photos
          </button>
          
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                activeTag === tag ? "bg-stone-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Responsive Pinterest-Style Masonry Matrix */}
      {photos.length === 0 ? (
        <div className="text-center py-12 text-xs text-stone-400 border border-dashed border-stone-200 rounded-lg">
          No approved media files match this category tag selection.
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              // 🟢 CHANGE: Add 'cursor-pointer' to explicitly notify the user they can interact
              onClick={() => setLightboxPhoto(photo)}
              className="break-inside-avoid mb-4 group relative overflow-hidden rounded-lg border border-stone-100 bg-stone-50 transition-transform duration-200 hover:-translate-y-0.5 shadow-sm cursor-pointer"
            >
              <img
                src={photo.url}
                alt={photo.caption || "Guest photo upload"}
                className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-102"
                loading="lazy"
              />
              {/* Info Frame HUD Revealed on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4 flex flex-col justify-end text-white">
                <p className="text-xs font-semibold">Shared by {photo.guestName}</p>
                {photo.caption && <p className="text-[11px] text-stone-300 italic mt-0.5">{photo.caption}</p>}
                
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {photo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🟢 LIGHTBOX MODAL TRIGGER ELEMENT ENTRY PANEL */}
      {lightboxPhoto && (
        <div 
          // Clicking anywhere on the transparent backdrop shuts down the display window
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950/95 p-4 animate-fade-in backdrop-blur-md cursor-zoom-out"
        >
          {/* Main Frame Box */}
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || "Lightbox presentation"}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
              onClick={(e) => e.stopPropagation()} // Prevents image clicks from closing modal
            />
          </div>

          {/* Context Sub-Card Text Box Information Row */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="mt-4 text-center max-w-xl text-stone-200 space-y-1 cursor-default"
          >
            <p className="text-sm font-medium">Shared by {lightboxPhoto.guestName}</p>
            {lightboxPhoto.caption && <p className="text-xs text-stone-400 italic">"{lightboxPhoto.caption}"</p>}
            
            {lightboxPhoto.tags && lightboxPhoto.tags.length > 0 && (
              <div className="flex justify-center flex-wrap gap-1.5 pt-1">
                {lightboxPhoto.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-stone-300">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Absolute Escape Button Anchor UI element */}
          <button 
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 text-stone-400 hover:text-white transition-colors p-2 text-2xl font-light"
            aria-label="Close lightbox modal"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
