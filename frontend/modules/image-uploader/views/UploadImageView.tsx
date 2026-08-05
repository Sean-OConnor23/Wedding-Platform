"use client";

import React from "react";
import { useUploadViewModel } from "../hooks/useUploadImageVm";

export const UploadImageView: React.FC = () => {
  const model = useUploadViewModel();

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-4" aria-label="Photo Ingestion">
      <h2 className="text-xl font-medium text-stone-700">📸 Share Your Memories</h2>
      <p className="text-xs text-stone-400">Upload wedding photos to watch our background server analyze and tag them keylessly.</p>
      
      <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:border-stone-400 transition-colors">
        <input 
          type="file" 
          accept="image/*" 
          onChange={model.handleFileUpload} 
          className="cursor-pointer text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100" 
        />
      </div>
      {model.uploadStatus && (
        <p className="text-sm font-medium text-center text-stone-600 animate-pulse">{model.uploadStatus}</p>
      )}
    </section>
  );
};
