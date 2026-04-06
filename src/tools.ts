import { tool } from 'ai'
import { describe, z } from 'zod'

export const tools = {
  generateDiagram: tool({
    description: 'Generate a complete diagram as na array of Excalidraw elements. Use this when the user asks you to create, draw, or design a new diagram. Return all elements needed including shapes, text labels, and arrow lines connecting them.',
    inputSchema: z.object({
      elements: z.array(z.object({
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
      }))
        .optional()
        .describe("Array of excalidray elements")
    }),
    execute: async ({ elements }) => {
      return {elements}
    }
  }),

  modifyDiagram: tool({
    description: 'Modify an  existing element on the canvas by id. Set only the fields you want to change, leave everything else alone please.',
    inputSchema: z.object({
      elementId: z.string().describe('The id of the element to modify.'),
      updates: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        text: z.string().optional(),
        fontSize: z.number().optional(),
        textAlign: z.enum(["left", "center", "right"]).optional(),
        strokeColor: z.string().optional(),
        backgroundColor: z.string().optional(),
        fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).optional(),
        strokeWidth: z.number().optional(),
        roughness: z.number().optional(),
        opacity: z.number().optional(),
      }),
    }),
    execute: async ({ elementId, updates }) => {
      return {elementId, updates}
    }
  })
}
