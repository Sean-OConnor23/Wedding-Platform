// app/modules/image-uploader/hooks/useUploadViewModel.ts
"use client";

import { useState, ChangeEvent, useCallback, useRef, useEffect } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:7071/api");

const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export function useUploadViewModel() {
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isRejected, setIsRejected] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clean up active uploads and polling timers on unmount
  useEffect(() => {
    return () => {
      clearPolling();
      abortControllerRef.current?.abort();
    };
  }, [clearPolling]);

  // Polls the status endpoint repeatedly until AI moderation finishes
  const startPollingStatus = useCallback(
    (photoId: string, signal: AbortSignal) => {
      clearPolling();
      let attempts = 0;

      intervalRef.current = setInterval(async () => {
        if (signal.aborted) {
          clearPolling();
          return;
        }

        attempts++;

        if (attempts > MAX_POLL_ATTEMPTS) {
          clearPolling();
          setIsUploading(false);
          setIsRejected(true);
          setUploadStatus("Optimization timeout. Please refresh the page gallery.");
          return;
        }

        try {
          const res = await fetch(
            `${API_BASE}/check-status?id=${encodeURIComponent(photoId)}`,
            { signal }
          );
          if (!res.ok) return;

          const data: unknown = await res.json();
          if (!data || typeof data !== "object") return;

          const status =
            "status" in data && typeof data.status === "string" ? data.status : "";
          const rejectionReason =
            "rejectionReason" in data && typeof data.rejectionReason === "string"
              ? data.rejectionReason
              : "Image did not pass moderation.";

          if (status === "APPROVED") {
            clearPolling();
            setIsUploading(false);
            setIsRejected(false);
            setUploadStatus("Uploaded! Your photo successfully passed AI verification!");
          } else if (status.startsWith("REJECTED")) {
            clearPolling();
            setIsUploading(false);
            setIsRejected(true);
            setUploadStatus(`Verification failed: ${rejectionReason}`);
          } else {
            setUploadStatus("Analyzing image context via AI Vision layers...");
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") {
            clearPolling();
          }
          // Suppress transient network drops during polling ticks
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPolling]
  );

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || isUploading) return;

      const file = files[0];

      // Reset file input so selecting the same file again still triggers onChange
      e.target.value = "";

      clearPolling();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsUploading(true);
      setIsRejected(false);
      setUploadStatus("Streaming file package to storage disks...");

      try {
        const fileBuffer = await file.arrayBuffer();
        const res = await fetch(`${API_BASE}/upload-image`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: fileBuffer,
          signal: controller.signal,
        });

        const data: unknown = await res.json();
        const filename =
          data && typeof data === "object" && "filename" in data && typeof data.filename === "string"
            ? data.filename
            : null;

        if (res.ok && filename) {
          setUploadStatus("Image written! Initializing background AI evaluation loops...");
          startPollingStatus(filename, controller.signal);
        } else {
          setIsUploading(false);
          setIsRejected(true);
          setUploadStatus(`Upload failed (${res.status}). Please try again.`);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setIsUploading(false);
        setIsRejected(true);
        setUploadStatus("Unable to connect to background upload endpoints.");
      }
    },
    [isUploading, clearPolling, startPollingStatus]
  );

  return { uploadStatus, isRejected, isUploading, handleFileUpload };
}
