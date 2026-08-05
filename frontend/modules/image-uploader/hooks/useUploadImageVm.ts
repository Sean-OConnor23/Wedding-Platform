"use client";

import { useState, ChangeEvent, useCallback } from "react";

export function useUploadViewModel() {
  const API_BASE = "http://localhost:7071/api";
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const fileBuffer = await file.arrayBuffer();
      
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: fileBuffer,
      });
      
      if (res.ok) {
        setUploadStatus("✅ Uploaded! AI is processing tags in the background.");
      } else {
        setUploadStatus(`❌ Upload failed: Status ${res.status}`);
      }
    } catch {
      setUploadStatus("❌ Network error connecting to backend server.");
    }
  }, []);

  return {
    uploadStatus,
    handleFileUpload
  };
}
