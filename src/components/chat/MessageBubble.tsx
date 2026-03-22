import MarkdownRenderer from "./MarkdownRenderer";
import type { Message } from "./types";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-role">
        {message.role === "user" ? "You" : "Assistant"}
      </div>
      <div className="message-content">
        {message.role === "assistant" ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <p>{message.content}</p>
        )}
      </div>
    </div>
  );
}
