"use client";

import React from "react";
import { useFaqViewModel } from "../hooks/useFaqAssistantVm";

export const FaqAssistantView: React.FC = () => {
  const model = useFaqViewModel();

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 flex flex-col h-[450px]" aria-label="AI Concierge Desk">
      <h2 className="text-xl font-medium text-stone-700 mb-4">🤖 Wedding AI Concierge</h2>
      
      {/* Chat History View */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-stone-50 rounded-xl mb-4 border border-stone-100">
        {model.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
              msg.sender === "guest" 
                ? "bg-amber-800 text-white" 
                : msg.sender === "system" 
                  ? "bg-red-50 text-red-600" 
                  : "bg-white text-stone-700 border border-stone-200"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={model.handleSendMessage} className="flex gap-2">
        <input 
          type="text" 
          value={model.chatInput} 
          onChange={(e) => model.setChatInput(e.target.value)} 
          placeholder="Ask about hotels, schedules, dress codes..." 
          className="flex-1 px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700/40 text-sm" 
        />
        <button type="submit" className="bg-amber-800 hover:bg-amber-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
          Ask
        </button>
      </form>
    </section>
  );
};
