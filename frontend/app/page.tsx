"use client";

import React, { useState } from "react";
import { FaqAssistantView } from "@/modules/faq-assistant/views/FaqAssistantView";
import { UploadImageView } from "@/modules/image-uploader/views/UploadImageView";
import { RsvpView } from "@/modules/rsvp/views/RsvpView";
import { GalleryView } from "@/modules/gallery/views/GalleryView";
import { RegistryView } from "@/modules/registry/views/RegistryView";
import { RegistryIngestionView } from "@/modules/registry/views/RegistryIngestionView";

type TabID = "rsvp" | "gallery" | "registry" | "concierge";

const TABS: { id: TabID; label: string }[] = [
  { id: "rsvp", label: "Guest RSVP" },
  { id: "gallery", label: "Photo Stream" },
  { id: "registry", label: "Gift Registry" },
  { id: "concierge", label: "AI Concierge" },
];

export default function HomeRouterPage() {
  const [activeTab, setActiveTab] = useState<TabID>("rsvp");

  return (
    <main className="wd-page-viewport">
      <div className="wd-content-constrain-box">
        
        {/* Core Header Layout */}
        <div className="wd-main-header">
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-700">
            Our Wedding Platform
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Wedding dashboard modules"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-2xl mx-auto mb-6"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`wd-nav-tab-trigger w-full text-center justify-center px-3 py-2.5 text-xs sm:text-sm ${
                  isActive ? "wd-nav-tab-active" : "wd-nav-tab-inactive"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic View Injection Shell */}
        <div>
          {activeTab === "rsvp" && (
            <div className="animate-fade-in">
              <RsvpView />
            </div>
          )}

          {activeTab === "gallery" && (
            <div className="animate-fade-in space-y-6">
              <UploadImageView />
              <GalleryView />
            </div>
          )}

          {activeTab === "registry" && (
            <div className="animate-fade-in space-y-6">
              <RegistryIngestionView />
              <RegistryView />
            </div>
          )}

          {activeTab === "concierge" && (
            <div className="animate-fade-in">
              <FaqAssistantView />
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
