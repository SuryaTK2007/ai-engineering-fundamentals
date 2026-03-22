import { useState, useCallback, useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import "./App.css";

// One agent instance per page load. The canvas state lives only in the
// browser, so persisting chat history across refreshes would leave a dead
// conversation referencing diagrams that no longer exist. Generated at the
// module level so React StrictMode's double mount doesn't change it.
const sessionId = crypto.randomUUID();

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Track which tool calls we have already applied to the canvas so we
  // don't apply the same elements twice as messages re-render.
  const appliedToolCalls = useRef<Set<string>>(new Set());

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  // Connect to a fresh agent instance for this page load
  const agent = useAgent({ agent: "design-agent", name: sessionId });

  // useAgentChat manages the chat protocol on top of the agent connection.
  // It gives us the messages array, a sendMessage function, and a status.
  const { messages, sendMessage, status } = useAgentChat({ agent });

  // Watch messages for tool outputs and apply them to the canvas.
  useEffect(() => {
    if (!excalidrawAPI) return;

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        if (
          part.type === "tool-generateDiagram" &&
          part.state === "output-available" &&
          !appliedToolCalls.current.has(part.toolCallId)
        ) {
          appliedToolCalls.current.add(part.toolCallId);
          const output = part.output as { elements?: unknown };
          const skeletonElements = output?.elements;
          if (Array.isArray(skeletonElements) && skeletonElements.length > 0) {
            // The agent returns simplified element shapes. Excalidraw needs
            // full element data (seed, versionNonce, etc.) which this helper
            // fills in from a skeleton.
            const elements = convertToExcalidrawElements(
              skeletonElements as any
            );
            excalidrawAPI.updateScene({ elements });
            excalidrawAPI.scrollToContent(elements, { fitToContent: true });
          }
        }
      }
    }
  }, [messages, excalidrawAPI]);

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel
        messages={messages}
        sendMessage={sendMessage}
        status={status}
      />
    </div>
  );
}
