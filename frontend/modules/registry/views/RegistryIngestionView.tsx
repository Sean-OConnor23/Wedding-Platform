// app/modules/registry/views/RegistryIngestionView.tsx
"use client";

import React from "react";
import { useRegistry } from "../hooks/useRegistry";
import { Button } from "@/components/Button";

export function RegistryIngestionView() {
  const {
    inputUrl,
    setInputUrl,
    inputStore,
    setInputStore,
    syncing,
    syncError,
    syncRegistryLink,
  } = useRegistry();

  const isFormIncomplete = !inputUrl.trim() || !inputStore.trim();

  return (
    <section
      className="wd-card-gallery"
      aria-label="Registry Data Ingestion"
    >
      <div className="space-y-1">
        <h2 className="wd-title-serif">Registry Data Ingestion</h2>
        <p className="wd-subtitle">
          Paste your public Registry ID or the full Registry URL. Our system hits the raw data feed directly.
        </p>
      </div>

      <form onSubmit={syncRegistryLink} className="wd-form-stack">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="wd-field-group">
            <label htmlFor="admin-store-input" className="wd-field-label">
              Retail Store Name
            </label>
            <input
              id="admin-store-input"
              type="text"
              required
              disabled={syncing}
              value={inputStore}
              onChange={(e) => setInputStore(e.target.value)}
              placeholder="Ex: Amazon, Target, Zola"
              className="wd-input-field-compact"
            />
          </div>

          <div className="wd-field-group sm:col-span-2">
            <label htmlFor="admin-url-input" className="wd-field-label">
              Product Page Destination URL
            </label>
            <input
              id="admin-url-input"
              type="url"
              required
              disabled={syncing}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://target.com..."
              className="wd-input-field-compact"
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="block"
          disabled={syncing || isFormIncomplete}
        >
          {syncing ? "Azure AI is Ingesting Content..." : "Sync Item to Registry"}
        </Button>

        {syncError && (
          <p
            role="alert"
            aria-live="polite"
            className="text-rose-600 text-xs font-medium text-center pt-1"
          >
            {syncError}
          </p>
        )}
      </form>
    </section>
  );
}
