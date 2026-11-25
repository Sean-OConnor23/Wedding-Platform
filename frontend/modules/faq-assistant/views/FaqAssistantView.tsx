"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { useFaqViewModel } from "../hooks/useFaqAssistantVm";

export const FaqAssistantView: React.FC = () => {
  const model = useFaqViewModel();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [model.messages, model.isLoading]);

  return (
    <section className="wd-card-base flex flex-col h-[450px]" aria-label="AI Concierge Desk">
      <h2 className="text-xl font-medium text-stone-700 mb-4">Wedding AI Concierge</h2>
      
      <div className="wd-chat-history-area">
        {model.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}>
            <div className={`wd-bubble-base ${
              msg.sender === "guest" 
                ? "wd-bubble-guest" 
                : msg.sender === "system" 
                  ? "wd-bubble-system" 
                  : "wd-bubble-ai"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {model.isLoading && (
          <div className="flex justify-start">
            <div className="wd-bubble-base wd-bubble-ai opacity-75 italic">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={model.handleSendMessage} className="wd-layout-flex-gapbox">
        <input 
          type="text" 
          value={model.chatInput} 
          onChange={(e) => model.setChatInput(e.target.value)} 
          placeholder="Ask about hotels, schedules, dress codes..." 
          className="wd-input-text"
          disabled={model.isLoading}
        />
    
        <Button type="submit" variant="primary" disabled={model.isLoading || !model.chatInput.trim()}>
          {model.isLoading ? "..." : "Ask"}
        </Button>
      </form>
    </section>
  );
};
