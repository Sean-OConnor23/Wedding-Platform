// modules/rsvp/hooks/useRsvp.ts
"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export interface InviteData {
  id: string;
  guestName: string;
  email: string;
  hasResponded: boolean;
  isAttending: boolean;
  mealSelection: string;
  comments: string;
}

export function useRsvpVm() {
  // 1. Safely pull the session context container
  const sessionContext = useSession();
  
  // 2. Safely fall back if the hook context is undefined during server build steps
  const session = sessionContext ? sessionContext.data : null;
  const status = sessionContext ? sessionContext.status : "unauthenticated";

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      setLoading(true);
      fetch(`http://localhost:7071/api/get-invite?email=${encodeURIComponent(session.user.email)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Invite not found");
          return res.json();
        })
        .then((data: InviteData) => setInvite(data))
        .catch(() => setMessage("We couldn't find an invitation matching your social email account."))
        .finally(() => setLoading(false));
    }
  }, [status, session]);

  const updateRsvpState = (updatedFields: Partial<InviteData>) => {
    if (!invite) return;
    setInvite({ ...invite, ...updatedFields });
  };

  const submitRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(`http://localhost:7071/api/update-rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invite.id,
          email: invite.email,
          isAttending: invite.isAttending,
          mealSelection: invite.mealSelection,
          comments: invite.comments,
        }),
      });

      if (res.ok) {
        setMessage("Thank you! Your RSVP has been updated successfully.");
      } else {
        setMessage("Something went wrong updating your RSVP. Please try again.");
      }
    } catch (err) {
      setMessage("Could not connect to the registration server.");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    session,
    status,
    invite,
    loading,
    submitting,
    message,
    updateRsvpState,
    submitRsvp,
  };
}
