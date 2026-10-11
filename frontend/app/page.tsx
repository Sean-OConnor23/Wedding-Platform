"use client";

import React, { useState } from "react";
import { FaqAssistantView } from "@/modules/faq-assistant/views/FaqAssistantView";
import { UploadImageView } from "@/modules/image-uploader/views/UploadImageView";
import { RsvpView } from "@/modules/rsvp/views/RsvpView";
import { GalleryView } from "@/modules/gallery/views/GalleryView";
import { RegistryView } from "@/modules/registry/views/RegistryView";
import { RegistryIngestionView } from "@/modules/registry/views/RegistryIngestionView";

type TabID = "rsvp" | "gallery" | "registry" | "concierge";

export default function HomeRouterPage() {
  const [activeTab, setActiveTab] = useState<TabID>("rsvp");

  const tabs = [
    { id: "rsvp" as TabID, label: "Guest RSVP" },
    { id: "gallery" as TabID, label: "Photo Stream" },
    { id: "registry" as TabID, label: "Gift Registry" },
    { id: "concierge" as TabID, label: "AI Concierge" },
  ];

  return (
    <main className="wd-page-viewport">
      <div className="wd-content-constrain-box">
        
        {/* Core Header Layout */}
        <div className="wd-main-header">
          <h1 className="text-4xl font-serif text-stone-700">Our Wedding Platform</h1>
        </div>

        <div className="wd-navbar-scroller-row" role="tablist" aria-label="Wedding dashboard modules">
        <div className="wd-navbar-centered-container">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`wd-nav-tab-trigger ${isActive ? "wd-nav-tab-active" : "wd-nav-tab-inactive"}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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
