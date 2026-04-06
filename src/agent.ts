import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { streamAgent } from "./agent-core";
import { compactHistory } from "./context/compaction";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
}

// Pull canvas state out of the latest user message's data part. The client
// attaches it to every outgoing message via App.tsx. We look at the most
// recent user message because the canvas only matters for what the user is
// asking about right now.
function extractCanvasState(messages: unknown[]): unknown[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string; parts?: unknown[] };
    if (m?.role !== "user" || !Array.isArray(m.parts)) continue;
    for (const part of m.parts) {
      const p = part as { type?: string; data?: { elements?: unknown[] } };
      if (p?.type === "data-canvas-state" && Array.isArray(p.data?.elements)) {
        return p.data.elements;
      }
    }
    return [];
  }
  return [];
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const openai = createOpenAI({ apiKey: this.env.OPENAI_API_KEY });
    const model = openai("gpt-5.4-mini");

    const canvasState = extractCanvasState(this.messages);

    // Compact older history if the conversation has gotten long. The recent
    // few turns stay verbatim; everything older is collapsed into one
    // summary system message.
    const allMessages = await convertToModelMessages(this.messages);
    const messages = await compactHistory(allMessages, { model });

    const result = streamAgent({
      model,
      messages,
      canvasState,
    });

    return result.toUIMessageStreamResponse();
  }
}
