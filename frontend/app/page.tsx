"use client";

import React, { useState } from "react";

interface Message {
  id: string;
  sender: "guest" | "assistant" | "system";
  text: string;
}

export default function WeddingHome() {
  const API_BASE = "http://localhost:7071/api";
  
  // State Management with strict TypeScript structures
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", sender: "assistant", text: "Hi! Ask me anything about the timeline, dress code, or locations!" }
  ]);
  const [input, setInput] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  // 1. Handle File Uploads to the Python Backend
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Capture the explicit file object
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      // Read the file natively into an ArrayBuffer (raw binary memory bytes)
      const fileBuffer = await file.arrayBuffer();

      const res = await fetch(`${API_BASE}/upload-image`, {
        method: "POST",
        headers: {
          "Content-Type": file.type, // Pass the exact mime-type (e.g. image/jpeg)
          "X-File-Name": file.name,   // Pass the name as a custom header if your backend needs it
        },
        body: fileBuffer, // Send the completely clean binary stream with no form wrappers!
      });

      if (res.ok) {
        setUploadStatus("✅ Uploaded! AI is processing tags in the background.");
      } else {
        setUploadStatus(`❌ Upload failed: Status ${res.status}`);
      }
    } catch (err) {
      setUploadStatus("❌ Network error connecting to backend.");
    }
  };

  // 2. Handle RAG Chatbot Submissions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const guestMessage: Message = { id: Date.now().toString(), sender: "guest", text: input };
    setMessages((prev) => [...prev, guestMessage]);
    setInput("");

    try {
      const res = await fetch(`${API_BASE}/ask-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input }),
      });
      
      const data = await res.json();
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "assistant", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "system", text: "System error processing message." }]);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8 text-stone-800">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Block */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif text-stone-700">💍 Our Wedding Platform</h1>
          <p className="text-stone-500">Powered by a Zero-Secret Python AI Backend</p>
        </div>

        {/* Media Upload Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-4">
          <h2 className="text-xl font-medium text-stone-700">📸 Share Your Memories</h2>
          <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:border-stone-400 transition-colors">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="cursor-pointer" />
            <p className="text-xs text-stone-400 mt-2">Images are automatically tagged via Computer Vision</p>
          </div>
          {uploadStatus && <p className="text-sm font-medium text-center text-stone-600">{uploadStatus}</p>}
        </div>

        {/* RAG Interactive Chatbot Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 flex flex-col h-[450px]">
          <h2 className="text-xl font-medium text-stone-700 mb-4">🤖 Wedding AI Concierge</h2>
          
          {/* Scrollable Chat Window */}
          <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-stone-50 rounded-xl mb-4 border border-stone-100">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "guest" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.sender === "guest" ? "bg-amber-800 text-white" : msg.sender === "system" ? "bg-red-50 text-red-600" : "bg-white text-stone-700 border border-stone-200"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Form Processing Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Where is the ceremony? What is the dress code?" 
              className="flex-1 px-4 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700/40 text-sm"
            />
            <button type="submit" className="bg-amber-800 hover:bg-amber-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
              Ask
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
