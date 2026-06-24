import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { tools } from "./tools";

interface Env {
  GROQ_API_KEY: string;
}

const SYSTEM_PROMPT = `You are a diagram design assistant. You help users create and modify diagrams on an Excalidraw canvas.

When the user asks you to create a diagram, use the generateDiagram tool to produce Excalidraw elements.

Guidelines for generating diagrams:
- Give each element a unique id (e.g. "rect-1", "text-1", "arrow-1")
- Position elements with reasonable spacing (at least 20px gap between elements)
- Use rectangles for boxes/containers, ellipses for circles, diamonds for decision points
- Add text labels inside or near shapes
- Connect related elements with arrows
- Use a clean layout: left to right or top to bottom
- Default to strokeColor "#1e1e1e" and backgroundColor "transparent"
- Set roughness to 1 for a hand-drawn look

For arrows and lines:
- Set x and y to the starting position
- Set width and height to 0
- Use points array with [x,y] coordinates relative to the element's x,y position
- For a simple arrow from (x1,y1) to (x2,y2), set x=x1, y=y1, and points=[[0,0], [x2-x1, y2-y1]]

When the user asks to modify an element, use the modifyDiagram tool with the element's id.`;

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const groq = createGroq({
      apiKey: this.env.GROQ_API_KEY,
    });

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(this.messages),
      tools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  }
}
