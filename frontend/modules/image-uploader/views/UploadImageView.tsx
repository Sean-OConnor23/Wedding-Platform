import React, { useRef } from "react";
import { useUploadViewModel } from "../hooks/useUploadImageVm";
import { Button } from "@/components/Button";

export const UploadImageView: React.FC = () => {
  const model = useUploadViewModel();
  // Creates an immutable reference point to access the native file input node directly
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="wd-upload-space-wrapper" aria-label="Photo Ingestion">
      <h2 className="wd-title-sans">Share Your Memories</h2>
      <p className="wd-subtitle">Upload wedding photos to watch our background server analyze and tag them keylessly.</p>
      
      {/* Clicking anywhere on this box triggers the file input dialog natively */}
      <div className="wd-upload-zone" onClick={handleZoneClick}>
        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*" 
          onChange={model.handleFileUpload} 
          className="hidden" // Hides the ugly native browser upload button completely
        />
        
        {/* Visual elements and a brand-matching button anchor inside the zone */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-600">Drag and drop your images here, or</p>
          <Button type="button" variant="primary" onClick={(e) => {
            e.stopPropagation(); // Prevents double-trigger events from bubbling up
            handleZoneClick();
          }}>
            Choose File
          </Button>
        </div>
      </div>
      
      {model.uploadStatus && (
        <p className="wd-upload-status-pulse">{model.uploadStatus}</p>
      )}
    </section>
  );
};
