// modules/rsvp/views/RsvpView.tsx
"use client";

import React from "react";
import { signIn, signOut } from "next-auth/react";
import { useRsvpVm } from "../hooks/useRsvpVm";

export function RsvpView() {
  const {
    session,
    status,
    invite,
    loading,
    submitting,
    message,
    updateRsvpState,
    submitRsvp,
  } = useRsvpVm();

  if (status === "loading" || loading) {
    return <div className="p-6 bg-white border border-stone-200 rounded-xl shadow-sm text-center text-stone-500 text-sm">Loading your personal invitation...</div>;
  }

  if (status === "unauthenticated" || !session) {
    return (
      <div className="p-8 bg-white border border-stone-200 rounded-xl shadow-sm text-center space-y-4">
        <h2 className="text-xl font-serif text-stone-700">🔒 Personalized Guest RSVP Portal</h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto">Please sign in with Google or Facebook to seamlessly access your custom invite properties.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button
            onClick={() => signIn("google")}
            className="px-5 py-2.5 border border-stone-300 rounded-lg text-stone-700 bg-white hover:bg-stone-50 transition-colors shadow-sm text-xs font-medium"
          >
            Sign In With Google
          </button>
          <button
            onClick={() => signIn("facebook")}
            className="px-5 py-2.5 rounded-lg text-white bg-[#1877F2] hover:bg-[#166FE5] transition-colors shadow-sm text-xs font-medium"
          >
            Sign In With Facebook
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="p-8 bg-white border border-stone-200 rounded-xl shadow-sm text-center space-y-3">
        <p className="text-rose-600 font-medium text-sm">{message}</p>
        <p className="text-stone-400 text-xs">Active Session: {session.user?.email}</p>
        <button onClick={() => signOut()} className="text-xs text-stone-600 underline font-medium">Try another profile</button>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white border border-stone-200 rounded-xl shadow-sm space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-stone-100">
        <div>
          <h2 className="text-xl font-serif text-stone-700">Welcome, {invite.guestName}</h2>
          <p className="text-xs text-stone-400">Linked to {session.user?.email}</p>
        </div>
        <button onClick={() => signOut()} className="text-xs text-stone-400 hover:text-stone-700 underline">Sign Out</button>
      </div>

      <form onSubmit={submitRsvp} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Attendance Status</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateRsvpState({ isAttending: true })}
              className={`py-2.5 rounded-lg text-xs font-medium border transition-all ${
                invite.isAttending
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              Accepts with Pleasure
            </button>
            <button
              type="button"
              onClick={() => updateRsvpState({ isAttending: false })}
              className={`py-2.5 rounded-lg text-xs font-medium border transition-all ${
                !invite.isAttending
                  ? "bg-rose-50 border-rose-300 text-rose-700"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              Declines with Regret
            </button>
          </div>
        </div>

        {invite.isAttending && (
          <>
            <div>
              <label htmlFor="meal-select" className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Entrée Selection</label>
              <select
                id="meal-select"
                value={invite.mealSelection}
                onChange={(e) => updateRsvpState({ mealSelection: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg text-stone-700 bg-white focus:ring-1 focus:ring-stone-400 outline-none transition-all"
              >
                <option value="">Choose an option...</option>
                <option value="beef">Prime Rib</option>
                <option value="fish">Atlantic Salmon</option>
                <option value="vegan">Mushroom Risotto (GF/Veg)</option>
              </select>
            </div>

            <div>
              <label htmlFor="dietary-notes" className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">Dietary & Comments</label>
              <textarea
                id="dietary-notes"
                rows={2}
                value={invite.comments}
                onChange={(e) => updateRsvpState({ comments: e.target.value })}
                placeholder="List any life-threatening food allergies or notes..."
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg text-stone-700 focus:ring-1 focus:ring-stone-400 outline-none transition-all resize-none"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-stone-700 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          {submitting ? "Updating Portal..." : "Commit RSVP Changes"}
        </button>

        {message && (
          <p className="text-center text-xs font-medium py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
