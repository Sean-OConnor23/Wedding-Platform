// app/modules/rsvp/hooks/useRsvp.ts
"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, FormEvent } from "react";

export interface InviteData {
  id: string;
  guestName: string;
  email: string;
  hasResponded: boolean;
  isAttending: boolean;
  mealSelection: string;
  comments: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:7071/api");

export function useRsvpVm() {
  const sessionContext = useSession();

  const session = sessionContext ? sessionContext.data : null;
  const status = sessionContext ? sessionContext.status : "unauthenticated";
  const userEmail = session?.user?.email?.trim().toLowerCase() || "";

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);

  const fetchInvite = useCallback(
    async (email: string, signal?: AbortSignal) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) return;

      setLoading(true);
      setMessage("");
      setIsError(false);

      try {
        const res = await fetch(
          `${API_BASE}/get-invite?email=${encodeURIComponent(normalizedEmail)}`,
          { signal }
        );

        if (res.status === 404) {
          setInvite(null);
          setIsError(true);
          setMessage("We couldn't find an invitation matching your signed-in email account.");
          return;
        }

        if (!res.ok) {
          throw new Error(`Unable to load invitation (${res.status}).`);
        }

        const data: unknown = await res.json();

        if (
          !data ||
          typeof data !== "object" ||
          ("found" in data && data.found === false) ||
          !("id" in data)
        ) {
          setInvite(null);
          setIsError(true);
          setMessage("We couldn't find an invitation matching your signed-in email account.");
          return;
        }

        setInvite(data as InviteData);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setInvite(null);
        setIsError(true);
        setMessage(
          err instanceof Error
            ? err.message
            : "We couldn't find an invitation matching your signed-in email account."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (status === "authenticated" && userEmail) {
      const controller = new AbortController();
      fetchInvite(userEmail, controller.signal);

      return () => controller.abort();
    }

    if (status === "unauthenticated") {
      setInvite(null);
      setMessage("");
      setIsError(false);
    }
  }, [status, userEmail, fetchInvite]);

  const updateRsvpState = useCallback((updatedFields: Partial<InviteData>) => {
    setInvite((prev) => (prev ? { ...prev, ...updatedFields } : null));
  }, []);

  const submitRsvp = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!invite || submitting) return;

      setSubmitting(true);
      setMessage("");
      setIsError(false);

      try {
        const res = await fetch(`${API_BASE}/update-rsvp`, {
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

        if (!res.ok) {
          throw new Error(`Something went wrong updating your RSVP (${res.status}).`);
        }

        setInvite((prev) => (prev ? { ...prev, hasResponded: true } : null));
        setIsError(false);
        setMessage("Thank you! Your RSVP has been updated successfully.");
      } catch (err: unknown) {
        setIsError(true);
        setMessage(
          err instanceof Error
            ? err.message
            : "Could not connect to the registration server."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [invite, submitting]
  );

  return {
    session,
    status,
    invite,
    loading,
    submitting,
    message,
    isError,
    updateRsvpState,
    submitRsvp,
    refetchInvite: () => (userEmail ? fetchInvite(userEmail) : Promise.resolve()),
  };
}
