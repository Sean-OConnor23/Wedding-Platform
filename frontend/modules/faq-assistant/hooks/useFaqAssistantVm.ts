"use client";

import { useState, FormEvent, useCallback } from "react";

export interface IChatMessage {
  readonly id: string;
  readonly sender: "guest" | "assistant" | "system";
  readonly text: string;
}

export function useFaqViewModel() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL  || "http://localhost:7071/api";

  const [messages, setMessages] = useState<readonly IChatMessage[]>([
    { id: "1", sender: "assistant", text: "Hi! Ask me anything about the timeline, dress code, or locations!" }
  ]);
  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const guestMsg: IChatMessage = { id: Date.now().toString(), sender: "guest", text: chatInput };
    setMessages((prev) => Object.freeze([...prev, guestMsg]));
    setChatInput("");

    try {
      const res = await fetch(`${API_BASE}/ask-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: chatInput }),
      });
      
      const data = await res.json();
      const record = Array.isArray(data) ? data[0] : data;
      setMessages((prev) => Object.freeze([...prev, { id: Date.now().toString(), sender: "assistant", text: record.reply }]));
    } catch {
      setMessages((prev) => Object.freeze([...prev, { id: Date.now().toString(), sender: "system", text: "System error processing message." }]));
    }
  }, [chatInput]);

  return {
    messages,
    chatInput,
    setChatInput,
    handleSendMessage
  };
}
