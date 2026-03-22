import { useState } from "react";
import MessageList from "./MessageList";
import type { Message } from "./types";
import "./chat.css";

export default function ChatPanel() {
  const [messages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Non-functional — wired up in lesson 3
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat</h2>
      </div>
      <MessageList messages={messages} />
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Describe a diagram..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="chat-send-btn">
          Send
        </button>
      </form>
    </div>
  );
}
