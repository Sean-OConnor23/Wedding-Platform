"use client";

import React from "react";
import { useRegistry } from "../hooks/useRegistry";
import { Button } from "@/components/Button";

export function RegistryView() {
  const { items, loading, error } = useRegistry();

  if (loading) return <div className="text-center py-8 text-xs text-stone-400">Scanning connected registries for price cuts...</div>;
  if (error) return <div className="text-center py-8 text-xs text-rose-500">Failed to pull registry directory: {error}</div>;

  return (
    <div className="wd-card-gallery">
      <div className="wd-registry-header-stack">
        <h2 className="wd-title-serif">Consolidated Gift Registry</h2>
        <p className="wd-subtitle">Combined wishlists across multiple platforms. Live metrics show alternative retail deals.</p>
      </div>

      {items.length === 0 ? (
        <div className="wd-photo-matrix-empty">Your wishlist is currently empty.</div>
      ) : (
        <div className="wd-registry-grid">
          {items.map((item) => (
            <div key={item.id} className="wd-registry-item-card">
              <div className="wd-item-info-stack">
                <h3 className="text-xs font-semibold text-stone-800 uppercase tracking-wide">{item.title}</h3>
                <div className="wd-item-meta-row">
                  <p className="text-[11px] text-stone-400">Registry Platform: <span className="font-semibold text-stone-600">{item.originalStore}</span></p>
                  {item.color && <span className="wd-variant-badge">Variant: {item.color}</span>}
                </div>
              </div>

              <div className="wd-price-box">
                <div className="wd-item-price-row">
                  <span className="text-stone-400">Retail Target Cost:</span>
                  <span className={`font-medium ${item.dealFound ? "line-through text-stone-400" : "text-stone-700"}`}>
                    \${item.originalPrice.toFixed(2)}
                  </span>
                </div>

                {item.dealFound && (
                  <div className="wd-deal-breakdown-box">
                    <div className="wd-deal-comparison-row">
                      <span className="text-xs font-bold text-emerald-600">Cheaper color-match at {item.cheaperMerchant}:</span>
                      <span className="text-base font-black text-emerald-600">\${item.bestAlternativePrice.toFixed(2)}</span>
                    </div>
                    <div className="wd-deal-savings-banner">
                      This option saves your guests <span className="font-bold">\${item.savingsAmount.toFixed(2)}</span>!
                    </div>
                    {item.couponCode && (
                      <p className="wd-coupon-caption">
                        Apply voucher code <code className="wd-coupon-code-chip">{item.couponCode}</code> at checkout.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="wd-layout-flex-gapbox">
                <Button onClick={() => window.open(item.originalRegistryUrl, "_blank", "noopener,noreferrer")}>
                  View Registry
                </Button>
                {item.dealFound && (
                  <Button onClick={() => window.open(`https://google.com{encodeURIComponent(item.title + " " + item.cheaperMerchant)}`, "_blank", "noopener,noreferrer")}>
                    Buy via {item.cheaperMerchant}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
