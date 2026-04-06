import { tool } from "ai";
import { z } from "zod";

// Tool definitions using the AI SDK's tool() helper with Zod schemas.
// These are intentionally naive:
// - generateDiagram asks the LLM to produce ALL elements in one shot
// - modifyDiagram requires knowing element IDs
// Both weaknesses will show up in evals and get improved in later lessons.

export const tools = {
  generateDiagram: tool({
    description:
      "Generate a complete diagram as an array of Excalidraw elements. Use this when the user asks you to create, draw, or design a new diagram. Return all elements needed including shapes, text labels, and arrows/lines connecting them. Position elements with x,y coordinates and give each a unique id.",
    inputSchema: z.object({
      elements: z.array(
        z.object({
          id: z.string().describe("Unique identifier"),
          type: z.enum(["rectangle", "ellipse", "diamond", "text", "arrow", "line"]),
          x: z.number().describe("X position"),
          y: z.number().describe("Y position"),
          width: z.number().describe("Width"),
          height: z.number().describe("Height"),
          strokeColor: z.string().default("#1e1e1e").describe("Stroke color (hex)"),
          backgroundColor: z.string().default("transparent").describe("Fill color"),
          fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).default("solid"),
          strokeWidth: z.number().default(2),
          roughness: z.number().default(1).describe("0 for clean, 1 for sketchy"),
          opacity: z.number().default(100),
          text: z.string().optional().describe("Text content (for text elements)"),
          fontSize: z.number().default(20),
          fontFamily: z.number().default(1).describe("1=Virgil, 2=Helvetica, 3=Cascadia"),
          textAlign: z.enum(["left", "center", "right"]).default("center"),
          points: z
            .array(z.array(z.number()))
            .optional()
            .describe("Array of [x,y] points (for arrow/line elements). Each point is a two number array."),
          startBinding: z
            .object({
              elementId: z.string(),
              focus: z.number(),
              gap: z.number(),
            })
            .optional()
            .describe("Bind arrow start to an element"),
          endBinding: z
            .object({
              elementId: z.string(),
              focus: z.number(),
              gap: z.number(),
            })
            .optional()
            .describe("Bind arrow end to an element"),
        })
      ).describe("Array of Excalidraw elements that make up the diagram"),
    }),
    execute: async ({ elements }) => {
      // Pass through. The LLM generates the elements, we just return them.
      return { elements };
    },
  }),

  modifyDiagram: tool({
    description:
      "Modify an existing element on the canvas by id. Set only the fields you want to change; everything else is left alone. Use this for tweaks like recolor, rename, move, resize, restyle. The element id must come from the current canvas state.",
    inputSchema: z.object({
      elementId: z.string().describe("The id of the element to modify"),
      // Explicit field list rather than a free form record. OpenAI's strict
      // tool calling rejects unconstrained additionalProperties, and giving
      // the model an enumerated list also tells it exactly what's tweakable.
      updates: z
        .object({
          x: z.number().optional().describe("New x position"),
          y: z.number().optional().describe("New y position"),
          width: z.number().optional().describe("New width"),
          height: z.number().optional().describe("New height"),
          text: z.string().optional().describe("New label or text content"),
          fontSize: z.number().optional(),
          textAlign: z.enum(["left", "center", "right"]).optional(),
          strokeColor: z.string().optional().describe("Hex stroke color"),
          backgroundColor: z.string().optional().describe("Hex fill color"),
          fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).optional(),
          strokeWidth: z.number().optional(),
          roughness: z.number().optional(),
          opacity: z.number().optional(),
        })
        .describe("Fields to change. Omit anything you don't want to touch."),
    }),
    execute: async ({ elementId, updates }) => {
      // Pass through. The client merges the updates into the existing element
      // via the Excalidraw API.
      return { elementId, updates };
    },
  }),
};
