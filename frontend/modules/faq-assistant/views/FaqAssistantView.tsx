// app/modules/faq-assistant/views/FaqAssistantView.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { useFaqViewModel } from "../hooks/useFaqAssistantVm";

export function FaqAssistantView() {
  const {
    messages,
    chatInput,
    setChatInput,
    isLoading,
    handleSendMessage,
    resetChat,
  } = useFaqViewModel();

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Scroll only the chat container (not the entire browser window) when messages update
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // Refocus the input after the assistant finishes replying
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isLoading]);

  const hasConversation = messages.length > 1;

  return (
    <section
      className="wd-card-base flex flex-col h-[450px]"
      aria-label="Wedding FAQ Assistant"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-stone-700">
          Wedding FAQ Assistant
        </h2>

        {hasConversation && (
          <button
            type="button"
            onClick={resetChat}
            disabled={isLoading}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
          >
            Clear chat
          </button>
        )}
      </div>

      <div
        ref={chatContainerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="wd-chat-history-area"
      >
        {messages.map((msg) => {
          const isGuest = msg.sender === "guest";
          const isSystem = msg.sender === "system";

          return (
            <div
              key={msg.id}
              className={`flex ${isGuest ? "justify-end" : "justify-start"}`}
            >
              <div
                role={isSystem ? "alert" : undefined}
                className={`wd-bubble-base whitespace-pre-wrap break-words ${
                  isGuest
                    ? "wd-bubble-guest"
                    : isSystem
                      ? "wd-bubble-system"
                      : "wd-bubble-ai"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start" role="status">
            <div className="wd-bubble-base wd-bubble-ai opacity-75 italic">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="wd-layout-flex-gapbox">
        <input
          ref={inputRef}
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask about hotels, schedules, dress codes..."
          aria-label="Ask a wedding question"
          maxLength={500}
          className="wd-input-text"
          disabled={isLoading}
        />

        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !chatInput.trim()}
        >
          {isLoading ? "..." : "Ask"}
        </Button>
      </form>
    </section>
  );
}
