import React from "react";
import { FaqAssistantView } from "@/modules/faq-assistant/views/FaqAssistantView";
import { UploadImageView } from "@/modules/image-uploader/views/UploadImageView";
import { RsvpView } from "@/modules/rsvp/views/RsvpView";

export default function HomeRouterPage() {
  return (
    <main className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Core Header Layout */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif text-stone-700">💍 Our Wedding Platform</h1>
          <p className="text-stone-500">Powered by a Zero-Secret Python AI Backend TEST</p>
        </div>

        <RsvpView />
        <UploadImageView />
        <FaqAssistantView/>

      </div>
    </main>
  );
}
