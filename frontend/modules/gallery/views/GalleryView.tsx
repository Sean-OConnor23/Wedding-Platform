// app/modules/gallery/views/GalleryView.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useGallery, PhotoAsset } from "../hooks/useGallery";

export function GalleryView() {
  const { photos, uniqueTags, activeTag, setActiveTag, loading, error, refetch } = useGallery();
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoAsset | null>(null);

  // Close lightbox on Escape key and prevent background scrolling while open
  useEffect(() => {
    if (!lightboxPhoto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxPhoto(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxPhoto]);

  if (loading) {
    return (
      <div className="text-center py-8 text-xs text-stone-400" role="status">
        Syncing live wedding photo stream...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-xs text-rose-500 space-y-2" role="alert">
        <p>Failed to render media assets: {error}</p>
        <button
          type="button"
          onClick={refetch}
          className="underline hover:text-rose-400 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="wd-card-gallery">
      <div className="wd-gallery-title-group">
        <h2 className="wd-title-serif">Guest Photo Gallery</h2>
        <p className="wd-subtitle">
          Captured live moments categorized automatically by Azure AI Vision
        </p>
      </div>

      {/* Dynamic AI Filter Tags Toolbar */}
      {uniqueTags.length > 0 && (
        <div className="wd-gallery-toolbar-row" role="group" aria-label="Photo category filters">
          <button
            type="button"
            onClick={() => setActiveTag("")}
            aria-pressed={activeTag === ""}
            className={`wd-filter-btn-base ${
              activeTag === "" ? "wd-filter-btn-active" : "wd-filter-btn-inactive"
            }`}
          >
            All Photos
          </button>

          {uniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              aria-pressed={activeTag === tag}
              className={`wd-filter-btn-base ${
                activeTag === tag ? "wd-filter-btn-active" : "wd-filter-btn-inactive"
              }`}
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
          {photos.map((photo) => {
            const guestLabel = photo.guestName?.trim() || "Wedding Guest";
            const altText = photo.caption?.trim() || `Photo shared by ${guestLabel}`;

            return (
              <div
                key={photo.id}
                role="button"
                tabIndex={0}
                onClick={() => setLightboxPhoto(photo)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxPhoto(photo);
                  }
                }}
                aria-label={`View photo: ${altText}`}
                className="wd-photo-item-card"
              >
                <img
                  src={photo.url}
                  alt={altText}
                  className="wd-photo-inner-image"
                  loading="lazy"
                  decoding="async"
                />
                <div className="wd-photo-hud-overlay">
                  <p className="text-xs font-semibold">Shared by {guestLabel}</p>
                  {photo.caption && (
                    <p className="wd-photo-caption-text">{photo.caption}</p>
                  )}
                  {Array.isArray(photo.tags) && photo.tags.length > 0 && (
                    <div className="wd-photo-tag-row">
                      {photo.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="wd-photo-tag-pill-compact">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox preview"
          onClick={() => setLightboxPhoto(null)}
          className="wd-lightbox-backdrop animate-fade-in"
        >
          <div className="wd-lightbox-center-frame">
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption?.trim() || "Lightbox presentation"}
              className="wd-lightbox-image-box"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div onClick={(e) => e.stopPropagation()} className="wd-lightbox-meta-card">
            <p className="text-sm font-medium">
              Shared by {lightboxPhoto.guestName?.trim() || "Wedding Guest"}
            </p>
            {lightboxPhoto.caption && (
              <p className="text-xs text-stone-400 italic">"{lightboxPhoto.caption}"</p>
            )}
            {Array.isArray(lightboxPhoto.tags) && lightboxPhoto.tags.length > 0 && (
              <div className="wd-lightbox-tag-row-centered">
                {lightboxPhoto.tags.map((tag) => (
                  <span key={tag} className="wd-lightbox-tag-pill-large">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="wd-lightbox-escape-btn"
            aria-label="Close lightbox modal"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
