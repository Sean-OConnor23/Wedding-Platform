"use client";

import { useState, FormEvent, useCallback } from "react";

export interface IChatMessage {
  readonly id: string;
  readonly sender: "guest" | "assistant" | "system";
  readonly text: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

export function useFaqViewModel() {
  const [messages, setMessages] = useState<readonly IChatMessage[]>([
    { id: "1", sender: "assistant", text: "Hi! Ask me anything about the timeline, dress code, or locations!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isLoading) return;

    const guestMsg: IChatMessage = {
      id: `${Date.now()}-guest`,
      sender: "guest",
      text: trimmedInput
    };
    setMessages((prev) => Object.freeze([...prev, guestMsg]));
    setChatInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/ask-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedInput }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const record = Array.isArray(data) ? data[0] : data;

      setMessages((prev) =>
        Object.freeze([
          ...prev,
          { id: `${Date.now()}-assistant`, sender: "assistant", text: record.reply }
        ])
      );
    } catch {
      setMessages((prev) =>
        Object.freeze([
          ...prev,
          { id: `${Date.now()}-system`, sender: "system", text: "System error processing message." }
        ])
      );
    } finally {
      setIsLoading(false);
    }
  }, [chatInput, isLoading]);

  return {
    messages,
    chatInput,
    setChatInput,
    isLoading,
    handleSendMessage
  };
}
