// app/modules/image-uploader/views/UploadImageView.tsx
"use client";

import React, { useRef, useState, DragEvent, KeyboardEvent } from "react";
import { useUploadViewModel } from "../hooks/useUploadImageVm";
import { Button } from "@/components/Button";

export function UploadImageView() {
  const { uploadStatus, isRejected, isUploading, handleFileUpload } =
    useUploadViewModel();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const triggerFileDialog = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerFileDialog();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (isUploading) return;

    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    // Assign dropped files to the hidden input and forward a synthetic ChangeEvent
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFiles[0]);
      fileInputRef.current.files = dataTransfer.files;

      handleFileUpload({
        target: fileInputRef.current,
        currentTarget: fileInputRef.current,
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <section
      className="wd-upload-space-wrapper"
      aria-label="Guest Photo Upload"
    >
      <h2 className="wd-title-sans">Share Your Memories</h2>
      <p className="wd-subtitle">
        Upload wedding photos to watch our background server analyze and tag them keylessly.
      </p>

      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-disabled={isUploading}
        aria-label="Upload photo dropzone"
        onClick={triggerFileDialog}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`wd-upload-zone transition-opacity ${
          isDragging ? "ring-2 ring-stone-400 bg-stone-50/70" : ""
        } ${isUploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          disabled={isUploading}
          onChange={handleFileUpload}
          className="hidden"
          aria-hidden="true"
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-600">
            {isDragging
              ? "Drop your photo here to upload"
              : "Drag and drop your images here, or"}
          </p>

          <Button
            type="button"
            variant="primary"
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              triggerFileDialog();
            }}
          >
            {isUploading ? "Uploading..." : "Choose File"}
          </Button>
        </div>
      </div>

      {uploadStatus && (
        <p
          role={isRejected ? "alert" : "status"}
          aria-live="polite"
          className={`wd-upload-status-pulse ${
            isRejected ? "text-rose-500" : ""
          }`}
        >
          {uploadStatus}
        </p>
      )}
    </section>
  );
}
