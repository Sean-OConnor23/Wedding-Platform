// app/modules/registry/views/RegistryView.tsx
"use client";

import React from "react";
import { useRegistry, RegistryItem } from "../hooks/useRegistry";
import { Button } from "@/components/Button";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: unknown): string {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(num);
}

export function RegistryView() {
  const { items, loading, error, refetch } = useRegistry();

  if (loading) {
    return (
      <div className="text-center py-8 text-xs text-stone-400" role="status">
        Scanning connected registries for price cuts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-xs text-rose-500 space-y-2" role="alert">
        <p>Failed to pull registry directory: {error}</p>
        <button
          type="button"
          onClick={refetch}
          className="underline hover:text-rose-400 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  const openExternalUrl = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className="wd-card-gallery"
      aria-label="Consolidated Gift Registry"
    >
      <div className="wd-registry-header-stack">
        <h2 className="wd-title-serif">Consolidated Gift Registry</h2>
        <p className="wd-subtitle">
          Combined wishlists across multiple platforms. Live metrics show alternative retail deals.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="wd-photo-matrix-empty">
          Your wishlist is currently empty.
        </div>
      ) : (
        <div className="wd-registry-grid">
          {items.map((item: RegistryItem) => {
            const searchQuery = encodeURIComponent(
              [item.title, item.color, item.cheaperMerchant]
                .filter(Boolean)
                .join(" ")
            );
            const alternativeSearchUrl = `https://google.com{searchQuery}`;

            return (
              <article key={item.id} className="wd-registry-item-card">
                <div className="wd-item-info-stack">
                  <h3 className="text-xs font-semibold text-stone-800 uppercase tracking-wide">
                    {item.title}
                  </h3>
                  <div className="wd-item-meta-row">
                    <p className="text-[11px] text-stone-400">
                      Registry Platform:{" "}
                      <span className="font-semibold text-stone-600">
                        {item.originalStore}
                      </span>
                    </p>
                    {item.color && (
                      <span className="wd-variant-badge">
                        Variant: {item.color}
                      </span>
                    )}
                  </div>
                </div>

                <div className="wd-price-box">
                  <div className="wd-item-price-row">
                    <span className="text-stone-400">Retail Target Cost:</span>
                    <span
                      className={`font-medium ${
                        item.dealFound
                          ? "line-through text-stone-400"
                          : "text-stone-700"
                      }`}
                    >
                      {formatCurrency(item.originalPrice)}
                    </span>
                  </div>

                  {item.dealFound && (
                    <div className="wd-deal-breakdown-box">
                      <div className="wd-deal-comparison-row">
                        <span className="text-xs font-bold text-emerald-600">
                          Cheaper color-match at {item.cheaperMerchant}:
                        </span>
                        <span className="text-base font-black text-emerald-600">
                          {formatCurrency(item.bestAlternativePrice)}
                        </span>
                      </div>
                      <div className="wd-deal-savings-banner">
                        This option saves your guests{" "}
                        <span className="font-bold">
                          {formatCurrency(item.savingsAmount)}
                        </span>
                        !
                      </div>
                      {item.couponCode && (
                        <p className="wd-coupon-caption">
                          Apply voucher code{" "}
                          <code className="wd-coupon-code-chip">
                            {item.couponCode}
                          </code>{" "}
                          at checkout.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="wd-layout-flex-gapbox">
                  <Button
                    type="button"
                    onClick={() => openExternalUrl(item.originalRegistryUrl)}
                  >
                    View Registry
                  </Button>
                  {item.dealFound && (
                    <Button
                      type="button"
                      onClick={() => openExternalUrl(alternativeSearchUrl)}
                    >
                      Buy via {item.cheaperMerchant}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
