// Shared agent logic. Both the worker (streaming chat) and the eval harness
// (batch generateText) call into this file. Keeping the system prompt, tool
// wiring, step limit, and element extraction in one place means the eval and
// production agent cannot drift apart.

import {
  generateText,
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { tools } from "./tools";
import { serializeCanvasState } from "./context/canvas-state";

export const SYSTEM_PROMPT = `# Role

You are a diagram design assistant that controls an Excalidraw canvas. Your job is to translate the user's requests into precise tool calls that draw or modify shapes on the canvas. You are not a chat bot. You are a tool using agent that produces diagrams.

# Capabilities

You have two tools:

- **generateDiagram(elements)** — produce a list of Excalidraw elements (rectangles, ellipses, diamonds, text, arrows, lines). Use this when the canvas is empty, when the user asks for something brand new, or when the existing diagram needs to be replaced from scratch.
- **modifyDiagram(elementId, updates)** — change a single existing element by id. Use this when the user wants to recolor, rename, move, resize, or otherwise tweak something already on the canvas. The current canvas state (described below) tells you which element ids exist.

# Output constraints

Every element you create must include: \`id\`, \`type\`, \`x\`, \`y\`, \`width\`, \`height\`. Pick concise ids that hint at meaning (\`rect_login\`, \`arrow_login_db\`, not \`element_42\`). Position elements with at least 20px of breathing room. Default to strokeColor \`#1e1e1e\`, backgroundColor \`transparent\`, roughness \`1\`. Use rectangles for boxes/containers, ellipses for circles or nodes, diamonds for decision points, arrows for directed connections, lines for undirected connections, text for standalone labels.

Layout flows left to right for processes and top to bottom for hierarchies. Group related elements visually.

# Behavioral guidelines

- **Use the canvas state.** If the canvas is non empty, the system message includes a summary of every element with its id and label. Never invent ids. Never call \`modifyDiagram\` on an id that isn't in the summary.
- **Prefer modifyDiagram for tweaks.** If the user says "make the login box red," do not regenerate the whole canvas. Find \`rect_login\` in the canvas state and call \`modifyDiagram("rect_login", { backgroundColor: "#fa5252" })\`.
- **Preserve what exists.** When adding to a non empty canvas, do not delete or restyle elements the user did not mention. Add new elements; leave the rest alone.
- **Ask one clarifying question only if the request is genuinely ambiguous.** "Draw something" is ambiguous. "Draw a flowchart for user signup" is not — make reasonable choices and draw it.

# Examples

**Example 1 — empty canvas, simple create**

User: "draw a circle and a square next to each other"

Call \`generateDiagram\` with two elements: an ellipse at \`(100, 100)\` 120x120 and a rectangle at \`(260, 100)\` 120x120. Reply: "Done — circle on the left, square on the right."

**Example 2 — non empty canvas, recolor**

Canvas state shows \`rect_login\` ("Login") and \`rect_db\` ("Database"). User: "make the login box red."

Call \`modifyDiagram("rect_login", { backgroundColor: "#fa5252" })\`. Reply: "Done — login box is now red."

**Example 3 — non empty canvas, additive**

Canvas state shows \`rect_api\` ("API") and \`rect_db\` ("Database"). User: "add a Cache box between them and route the API through the cache."

Call \`generateDiagram\` with one new rectangle \`rect_cache\` ("Cache") positioned between the two existing boxes, plus arrows from \`rect_api\` to \`rect_cache\` and from \`rect_cache\` to \`rect_db\`. Do not redraw \`rect_api\` or \`rect_db\` — they already exist. Reply: "Added the cache between API and Database."`;

interface AgentArgs {
  model: LanguageModel;
  messages: ModelMessage[];
  // Current canvas state. Gets serialized and appended to the system prompt
  // so the model knows what already exists. Pass `[]` (or omit) for an empty
  // canvas. The worker reads this from the latest user message's
  // data-canvas-state part. The eval passes `testCase.seed?.elements`.
  canvasState?: unknown[];
  system?: string;
  maxSteps?: number;
}

function buildSystem(base: string, canvasState: unknown[] | undefined): string {
  return `${base}\n\n# Current canvas state\n\n${serializeCanvasState(canvasState ?? [])}`;
}

// Streaming variant. Used by the worker for the live chat experience.
export function streamAgent({
  model,
  messages,
  canvasState,
  system = SYSTEM_PROMPT,
  maxSteps = 5,
}: AgentArgs) {
  return streamText({
    model,
    system: buildSystem(system, canvasState),
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });
}

// Non-streaming variant. Used by the eval harness so we can collect the full
// result and pull out elements for scoring.
export async function runAgent({
  model,
  messages,
  canvasState,
  system = SYSTEM_PROMPT,
  maxSteps = 5,
}: AgentArgs) {
  const result = await generateText({
    model,
    system: buildSystem(system, canvasState),
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });
  return {
    text: result.text,
    elements: extractElements(result.steps, canvasState ?? []),
    steps: result.steps,
  };
}

// Walk the agent's tool calls in order and simulate what the canvas would
// look like after they were all applied. Starts from `initial` (the seed
// canvas state for modify cases, or `[]` for create cases).
//
// - generateDiagram REPLACES the canvas with the new elements (matches the
//   naive tool's behavior — it produces a full element list)
// - modifyDiagram merges updates into the matching element by id
//
// This is what lets the eval's preservation scorer see whether the agent
// actually preserved seed elements: it's the post-application state, not
// just the raw tool outputs.
interface StepLike {
  toolResults?: {
    toolName: string;
    input?: unknown;
    output: unknown;
  }[];
}

export function extractElements(steps: StepLike[], initial: unknown[] = []): unknown[] {
  let canvas: Record<string, unknown>[] = (initial as Record<string, unknown>[]).map((el) => ({ ...el }));

  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      if (toolResult.toolName === "generateDiagram") {
        const output = toolResult.output as { elements?: unknown[] };
        if (Array.isArray(output?.elements)) {
          canvas = output.elements.map((el) => ({ ...(el as object) }));
        }
      } else if (toolResult.toolName === "modifyDiagram") {
        const output = toolResult.output as {
          elementId?: unknown;
          updates?: Record<string, unknown>;
        };
        if (typeof output?.elementId === "string" && output.updates) {
          const target = canvas.find((el) => el.id === output.elementId);
          if (target) Object.assign(target, output.updates);
        }
      }
    }
  }

  return canvas;
}
