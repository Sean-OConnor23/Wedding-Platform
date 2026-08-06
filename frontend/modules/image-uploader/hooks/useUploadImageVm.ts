"use client";

import { useState, ChangeEvent, useCallback } from "react";

export function useUploadViewModel() {
  const API_BASE = "http://localhost:7071/api";
  const [uploadStatus, setUploadStatus] = useState("");
  const [isRejected, setIsRejected] = useState(false);

  // Polls the status endpoint repeatedly until processing finishes
  const startPollingStatus = useCallback((photoId: string) => {
    let attempts = 0;
    
    const interval = setInterval(async () => {
      attempts++;
      
      // Safety net: stop checking after 30 seconds if the server locks up
      if (attempts > 15) {
        clearInterval(interval);
        setIsRejected(true);
        setUploadStatus("Optimization timeout. Please refresh the page gallery.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/check-status?id=${photoId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "APPROVED") {
          clearInterval(interval);
          setIsRejected(false);
          setUploadStatus("Uploaded! Your photo successfully passed AI verification!");
        } else if (data.status.startsWith("REJECTED")) {
          clearInterval(interval);
          setIsRejected(true);
          setUploadStatus(`Verification failed: ${data.rejectionReason}`);
        } else {
          // If status is still "PROCESSING", do nothing and wait for the next interval tick
          setUploadStatus("Analyzing image context via AI Vision layers...");
        }
      } catch {
        // Suppress network drops during parsing transitions
      }
    }, 2000); // Check every 2000 milliseconds (2 seconds)
  }, []);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setUploadStatus("⚡ Streaming file package to storage disks...");
    setIsRejected(false);

    try {
      const fileBuffer = await file.arrayBuffer();
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: fileBuffer,
      });
      
      const data = await res.json();

      if (res.ok && data.filename) {
        setUploadStatus("Image written! Initializing background AI evaluation loops...");
        // LAUNCH THE ENTERPRISE STATUS CHECK POLLING ENGINE!
        startPollingStatus(data.filename);
      } else {
        setIsRejected(true);
        setUploadStatus("Network transmission failed.");
      }
    } catch {
      setIsRejected(true);
      setUploadStatus("Unable to connect to background upload endpoints.");
    }
  }, [startPollingStatus]);

  return { uploadStatus, isRejected, handleFileUpload };
}
