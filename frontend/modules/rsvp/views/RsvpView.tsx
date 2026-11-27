// app/modules/rsvp/views/RsvpView.tsx
"use client";

import React from "react";
import { signIn, signOut } from "next-auth/react";
import { useRsvpVm } from "../hooks/useRsvpVm";
import { Button } from "@/components/Button";

export function RsvpView() {
  const {
    session,
    status,
    invite,
    loading,
    submitting,
    message,
    isError,
    updateRsvpState,
    submitRsvp,
    refetchInvite,
  } = useRsvpVm();

  if (status === "loading" || loading) {
    return (
      <div
        className="wd-card-base text-center text-stone-500 text-sm"
        role="status"
      >
        Loading your personal invitation...
      </div>
    );
  }

  if (status === "unauthenticated" || !session) {
    return (
      <div className="wd-card-base text-center space-y-4">
        <h2 className="wd-portal-title">Personalized Guest RSVP Portal</h2>
        <p className="wd-portal-text">
          Please sign in with Google or Facebook to seamlessly access your custom invite properties.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => signIn("google")}
            className="wd-btn-oauth-google"
          >
            Sign In With Google
          </Button>
          <Button
            type="button"
            onClick={() => signIn("facebook")}
            className="wd-btn-oauth-facebook"
          >
            Sign In With Facebook
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="wd-card-base text-center space-y-3" role="alert">
        <p className="text-rose-600 font-medium text-sm">
          {message || "We couldn't find an invitation matching your signed-in email account."}
        </p>
        <p className="text-stone-400 text-xs">
          Active Session: {session.user?.email}
        </p>
        <div className="flex justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={refetchInvite}
            className="text-xs text-stone-600 underline font-medium cursor-pointer"
          >
            Retry Lookup
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-stone-600 underline font-medium cursor-pointer"
          >
            Try another profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wd-card-gallery">
      <div className="flex justify-between items-center pb-4 border-b border-stone-100">
        <div>
          <h2 className="wd-title-serif">Welcome, {invite.guestName}</h2>
          <p className="wd-subtitle">Linked to {session.user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs text-stone-400 hover:text-stone-700 underline cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <form onSubmit={submitRsvp} className="wd-form-stack">
        <div>
          <span id="attendance-label" className="wd-field-label mb-2 block">
            Attendance Status
          </span>
          <div
            role="group"
            aria-labelledby="attendance-label"
            className="wd-choice-matrix-grid"
          >
            <Button
              type="button"
              disabled={submitting}
              aria-pressed={invite.isAttending}
              onClick={() => updateRsvpState({ isAttending: true })}
              className={`wd-choice-btn-base ${
                invite.isAttending ? "wd-choice-accept-active" : "wd-choice-inactive"
              }`}
            >
              Accepts with Pleasure
            </Button>
            <Button
              type="button"
              disabled={submitting}
              aria-pressed={!invite.isAttending}
              onClick={() =>
                updateRsvpState({
                  isAttending: false,
                  mealSelection: "",
                })
              }
              className={`wd-choice-btn-base ${
                !invite.isAttending ? "wd-choice-decline-active" : "wd-choice-inactive"
              }`}
            >
              Declines with Regret
            </Button>
          </div>
        </div>

        {invite.isAttending && (
          <>
            <div className="wd-field-group">
              <label htmlFor="meal-select" className="wd-field-label">
                Entrée Selection
              </label>
              <select
                id="meal-select"
                required
                disabled={submitting}
                value={invite.mealSelection || ""}
                onChange={(e) => updateRsvpState({ mealSelection: e.target.value })}
                className="wd-select-field"
              >
                <option value="" disabled>
                  Choose an option...
                </option>
                <option value="beef">Prime Rib</option>
                <option value="fish">Atlantic Salmon</option>
                <option value="vegan">Mushroom Risotto (GF/Veg)</option>
              </select>
            </div>

            <div className="wd-field-group">
              <label htmlFor="dietary-notes" className="wd-field-label">
                Dietary & Comments
              </label>
              <textarea
                id="dietary-notes"
                rows={2}
                disabled={submitting}
                value={invite.comments || ""}
                onChange={(e) => updateRsvpState({ comments: e.target.value })}
                placeholder="List any life-threatening food allergies or notes..."
                className="wd-textarea-field"
              />
            </div>
          </>
        )}

        <Button type="submit" variant="block" disabled={submitting}>
          {submitting ? "Updating Portal..." : "Commit RSVP Changes"}
        </Button>

        {message && (
          <p
            role={isError ? "alert" : "status"}
            aria-live="polite"
            className={
              isError
                ? "text-rose-600 text-xs font-medium text-center pt-1"
                : "wd-banner-success"
            }
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
