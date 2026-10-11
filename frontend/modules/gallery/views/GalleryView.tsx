"use client";

import React, { useState } from "react";
import { useGallery, PhotoAsset } from "../hooks/useGallery";

export function GalleryView() {
  const { photos, uniqueTags, activeTag, setActiveTag, loading, error } = useGallery();
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoAsset | null>(null);

  if (loading) return <div className="text-center py-8 text-xs text-stone-400">Syncing live wedding photo stream...</div>;
  if (error) return <div className="text-center py-8 text-xs text-rose-500">Failed to render media assets: {error}</div>;

  return (
    <div className="wd-card-gallery">
      <div className="wd-gallery-title-group">
        <h2 className="wd-title-serif">Guest Photo Gallery</h2>
        <p className="wd-subtitle">Captured live moments categorized automatically by Azure AI Vision</p>
      </div>

      {/* Dynamic AI Filter Tags Toolbar */}
      {uniqueTags.length > 0 && (
        <div className="wd-gallery-toolbar-row">
          <button
            onClick={() => setActiveTag("")}
            className={`wd-filter-btn-base ${activeTag === "" ? "wd-filter-btn-active" : "wd-filter-btn-inactive"}`}
          >
            All Photos
          </button>
          
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`wd-filter-btn-base ${activeTag === tag ? "wd-filter-btn-active" : "wd-filter-btn-inactive"}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Responsive Pinterest-Style Masonry Matrix */}
      {photos.length === 0 ? (
        <div className="wd-photo-matrix-empty">
          No approved media files match this category tag selection.
        </div>
      ) : (
        <div className="wd-photo-matrix-grid">
          {photos.map((photo) => (
            <div key={photo.id} onClick={() => setLightboxPhoto(photo)} className="wd-photo-item-card">
              <img
                src={photo.url}
                alt={photo.caption || "Guest photo upload"}
                className="wd-photo-inner-image"
                loading="lazy"
              />
              <div className="wd-photo-hud-overlay">
                <p className="text-xs font-semibold">Shared by {photo.guestName}</p>
                {photo.caption && <p className="wd-photo-caption-text">{photo.caption}</p>}
                {photo.tags && photo.tags.length > 0 && (
                  <div className="wd-photo-tag-row">
                    {photo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="wd-photo-tag-pill-compact">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX MODAL PANEL SCREEN CONTAINER */}
      {lightboxPhoto && (
        <div onClick={() => setLightboxPhoto(null)} className="wd-lightbox-backdrop animate-fade-in">
          <div className="wd-lightbox-center-frame">
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || "Lightbox presentation"}
              className="wd-lightbox-image-box"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div onClick={(e) => e.stopPropagation()} className="wd-lightbox-meta-card">
            <p className="text-sm font-medium">Shared by {lightboxPhoto.guestName}</p>
            {lightboxPhoto.caption && <p className="text-xs text-stone-400 italic">"{lightboxPhoto.caption}"</p>}
            {lightboxPhoto.tags && lightboxPhoto.tags.length > 0 && (
              <div className="wd-lightbox-tag-row-centered">
                {lightboxPhoto.tags.map((tag) => (
                  <span key={tag} className="wd-lightbox-tag-pill-large">#{tag}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setLightboxPhoto(null)} className="wd-lightbox-escape-btn" aria-label="Close lightbox modal">✕</button>
        </div>
      )}
    </div>
  );
}
