"use client";

import React from "react";
import { Button } from "@/components/Button";
import { useFaqViewModel } from "../hooks/useFaqAssistantVm";

export const FaqAssistantView: React.FC = () => {
  const model = useFaqViewModel();

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
      </div>

      <form onSubmit={model.handleSendMessage} className="wd-layout-flex-gapbox">
        <input 
          type="text" 
          value={model.chatInput} 
          
          
          onChange={(e) => model.setChatInput(e.target.value)} 
          
          placeholder="Ask about hotels, schedules, dress codes..." 
          className="wd-input-text" 
        />
    
        <Button type="submit" variant="primary">
          Ask
        </Button>
      </form>
    </section>
  );
};
