// app/modules/faq-assistant/hooks/useFaqViewModel.ts
"use client";

import { useState, FormEvent, useCallback, useRef, useEffect } from "react";

export interface IChatMessage {
  readonly id: string;
  readonly sender: "guest" | "assistant" | "system";
  readonly text: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:7071/api");

const INITIAL_MESSAGES: readonly IChatMessage[] = Object.freeze([
  {
    id: "welcome-1",
    sender: "assistant",
    text: "Hi! Ask me anything about the timeline, dress code, or locations!",
  },
]);

function createId(suffix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}-${suffix}`;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${suffix}`;
}

export function useFaqViewModel() {
  const [messages, setMessages] = useState<readonly IChatMessage[]>(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmedInput = chatInput.trim();
      if (!trimmedInput || isLoading) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const guestMsg: IChatMessage = {
        id: createId("guest"),
        sender: "guest",
        text: trimmedInput,
      };

      setMessages((prev) => Object.freeze([...prev, guestMsg]));
      setChatInput("");
      setIsLoading(true);

      try {
        const res = await fetch(`${API_BASE}/ask-assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmedInput }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Assistant request failed (${res.status}).`);
        }

        const data: unknown = await res.json();
        const record = Array.isArray(data) ? data[0] : data;
        const reply =
          record && typeof record === "object" && "reply" in record && typeof record.reply === "string"
            ? record.reply
            : null;

        if (!reply) {
          throw new Error("Assistant returned an empty response.");
        }

        setMessages((prev) =>
          Object.freeze([
            ...prev,
            {
              id: createId("assistant"),
              sender: "assistant",
              text: reply,
            },
          ])
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setMessages((prev) =>
          Object.freeze([
            ...prev,
            {
              id: createId("system"),
              sender: "system",
              text: "Sorry, I couldn't process your question right now. Please try again.",
            },
          ])
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [chatInput, isLoading]
  );

  const resetChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages(INITIAL_MESSAGES);
    setChatInput("");
    setIsLoading(false);
  }, []);

  return {
    messages,
    chatInput,
    setChatInput,
    isLoading,
    handleSendMessage,
    resetChat,
  };
}
