# Context Engineering

This is the first real "improvement" lesson. The theme is **context engineering**: deciding what goes into the model's context window, in what shape, on every turn. Two pieces:

1. **Rewrite the system prompt** to be more thorough and add few shot examples (zero shot to multi shot).
2. **Serialize the canvas state** into the system prompt at request time, so the agent finally knows what exists.

Context engineering is "put the right information in front of the model in the right shape at the right time." It is the lowest hanging fruit in any agentic system, and most teams skip straight to fine tuning when they should just be putting better context in their prompts.

## Set a baseline first

Before changing anything, run the eval to capture a baseline so we have something to compare against at the end.

```bash
npm run eval
```

A new experiment shows up in Braintrust, tagged with the current branch and commit. Note the four scores. If you've already captured a baseline for this branch and want a fresh one, delete the old experiment from the Braintrust dashboard first.

## Rewriting `SYSTEM_PROMPT`

The current prompt is **zero shot**: a short list of bullet point guidelines and no examples. Zero shot prompts ask the model to figure out the right behavior from a description alone. They're fine for trivial tasks, brittle for anything where the model has to make a judgment call (like "should I regenerate or modify?").

The upgrade is **few shot** (sometimes called multi shot): show the model 2 or 3 short input, action, reply patterns that demonstrate the exact decision you want it to make. Few shot examples are most useful when they teach a decision boundary, not when they show pretty results. We're also taking the chance to be more thorough overall: explicit role, capabilities, output constraints, and behavioral guidelines, instead of one undifferentiated bullet list.

The new prompt follows that structure. Excerpt:

**`src/agent-core.ts`**:

```ts
export const SYSTEM_PROMPT = `# Role

You are a diagram design assistant that controls an Excalidraw canvas. Your job is to translate the user's requests into precise tool calls that draw or modify shapes on the canvas. You are not a chat bot. You are a tool using agent that produces diagrams.

# Capabilities

You have two tools:

- **generateDiagram(elements)** — produce a list of Excalidraw elements... Use this when the canvas is empty, when the user asks for something brand new, or when the existing diagram needs to be replaced from scratch.
- **modifyDiagram(elementId, updates)** — change a single existing element by id. Use this when the user wants to recolor, rename, move, resize, or otherwise tweak something already on the canvas.

# Output constraints

Every element you create must include id, type, x, y, width, height...

# Behavioral guidelines

- Use the canvas state. If the canvas is non empty, the system message includes a summary of every element with its id and label. Never invent ids.
- Prefer modifyDiagram for tweaks. If the user says "make the login box red," do not regenerate the whole canvas.
- Preserve what exists. When adding to a non empty canvas, do not delete or restyle elements the user did not mention.
- Ask one clarifying question only if the request is genuinely ambiguous.

# Examples

**Example 1 — empty canvas, simple create**
User: "draw a circle and a square next to each other"
Call generateDiagram with two elements... Reply: "Done — circle on the left, square on the right."

**Example 2 — non empty canvas, recolor**
Canvas state shows rect_login ("Login") and rect_db ("Database").
User: "make the login box red."
Call modifyDiagram("rect_login", { backgroundColor: "#fa5252" }). Reply: "Done — login box is now red."

**Example 3 — non empty canvas, additive**
Canvas state shows rect_api ("API") and rect_db ("Database").
User: "add a Cache box between them and route the API through the cache."
Call generateDiagram with one new rectangle rect_cache plus arrows... Do not redraw rect_api or rect_db — they already exist.`;
```

The full version is in `src/agent-core.ts`. The examples don't just show good output, they show **the exact decision the model needs to make**: which tool to call given which canvas state.

## Canvas state in context

We're going to let the model "see" the canvas by sending it along with every user message and dropping a serialized version into the system prompt.

### Serializing the canvas

Raw Excalidraw JSON is huge. Every element has dozens of fields and the model doesn't need most of them. We have to pick a serialization format and what to include.

#### Why not JSON

The obvious move is "just send the JSON." Don't. A few reasons:

1. **Token cost.** JSON's structural characters (quotes, braces, brackets, commas, repeated keys on every object) are pure overhead. For tabular data this can be **40 to 60 percent** of the tokens before you've encoded a single value. Multiply that by every turn and the canvas alone eats your context budget.
2. **Model preference.** JSON inside a prompt reads to the model as "data I might need to echo back," which is the opposite of what we want when the data is context, not output.
3. **There are better formats.** People measured their JSON token bills and built alternatives. **TOON** (Token Oriented Object Notation), YAML, and various shorthand notations consistently come in 30 to 50 percent cheaper than JSON for the same payload, with equal or better task accuracy.

The principle: **JSON is a wire format for machines, not a context format for language models.** Use it at API boundaries, transform it to something denser before it hits the prompt.

For our canvas we go with [TOON](https://toonformat.dev). Our elements are an array of objects with the same shape, which is the exact case TOON is built for.

#### The serializer

```bash
npm install @toon-format/toon
```

**`src/context/canvas-state.ts`**:

```ts
import { encode } from "@toon-format/toon";
import type { ExcalidrawElement } from "../schemas";

export function serializeCanvasState(elements: ExcalidrawElement[]): string {
  if (!elements.length) return "canvas: empty";

  const rows = elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: Math.round(el.x),
    y: Math.round(el.y),
    w: Math.round(el.width),
    h: Math.round(el.height),
    label: el.type === "text" ? el.text : "",
    from: el.type === "arrow" ? el.startBinding?.elementId ?? "" : "",
    to: el.type === "arrow" ? el.endBinding?.elementId ?? "" : "",
  }));

  return encode(
    { elements: rows },
    { indent: 2, delimiter: ",", keyFolding: "off", flattenDepth: Infinity }
  );
}
```

### Wiring it through `agent-core`

Both the worker (live chat) and the eval (batch generateText) need canvas state. Instead of duplicating the assembly logic, we add a `canvasState` parameter to `streamAgent` / `runAgent` in `src/agent-core.ts` and they handle the system prompt assembly internally.

**`src/agent-core.ts`**:

```ts
interface AgentArgs {
  model: LanguageModel;
  messages: ModelMessage[];
  canvasState?: unknown[];
  system?: string;
  maxSteps?: number;
}

function buildSystem(base: string, canvasState: unknown[] | undefined): string {
  return `${base}\n\n# Current canvas state\n\n${serializeCanvasState(canvasState ?? [])}`;
}

export function streamAgent({ model, messages, canvasState, system = SYSTEM_PROMPT, maxSteps = 5 }: AgentArgs) {
  return streamText({
    model,
    system: buildSystem(system, canvasState),
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });
}
```

Now any caller that has elements just passes them in. `runAgent` does the same thing.

### Browser side: data part on the user message

The Cloudflare AI Chat protocol only sends `UIMessage` objects over the WebSocket. There's no sidecar channel. The way to attach extra payload to a turn is to ride along on the user's message itself, via a **custom data part**. The AI SDK reserves part types prefixed with `data-` for this. They're arbitrary JSON the SDK passes through untouched, and they're dropped before the model ever sees them.

Wrap `sendMessage` so every outgoing user message gets a `data-canvas-state` part appended:

**`src/App.tsx`**:

```ts
const sendWithCanvas = useMemo(
  () => (msg: { role: "user"; parts: { type: "text"; text: string }[] }) => {
    const elements = excalidrawAPI?.getSceneElements() ?? [];
    sendMessage({
      ...msg,
      parts: [
        ...msg.parts,
        { type: "data-canvas-state", data: { elements } } as never,
      ],
    });
  },
  [sendMessage, excalidrawAPI]
);
```

Then pass `sendWithCanvas` to `<ChatPanel>` instead of the raw `sendMessage`. `ChatPanel` doesn't know about canvas state, it just calls the function it's given.

### Worker side: read it back

`onChatMessage` runs because the user just sent a message, so the last entry in `this.messages` is always that user turn. Read its `data-canvas-state` part, hand it to `streamAgent`, done.

**`src/agent.ts`**:

```ts
import type { UIMessage } from "ai";
import type { ExcalidrawElement } from "./schemas";

type CanvasStatePart = { type: "data-canvas-state"; data: { elements: ExcalidrawElement[] } };

function extractCanvasState(messages: UIMessage[]): ExcalidrawElement[] {
  const last = messages.at(-1);
  const part = last?.parts.find((p): p is CanvasStatePart => p.type === "data-canvas-state");
  return part?.data.elements ?? [];
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const openai = createOpenAI({ apiKey: this.env.OPENAI_API_KEY });
    const model = openai("gpt-5.4-mini");

    const canvasState = extractCanvasState(this.messages);
    const messages = await convertToModelMessages(this.messages);

    const result = streamAgent({ model, messages, canvasState });
    return result.toUIMessageStreamResponse();
  }
}
```

Each turn rebuilds the system prompt fresh from the canvas data part on that turn's user message. Old canvas state never accumulates.

## Re-run the eval

```bash
npm run eval
```

Compare against the baseline you captured at the start of the lesson. Things to watch for:

- **Schema** should be at or near 100. The new prompt is strict enough that the agent shouldn't be producing malformed elements. If it drops, look at what the agent is generating in the dashboard.
- **Preservation** is the headline metric for this lesson. A 1.5x to 2x jump is the rough target. If it barely moves, something is wrong with how the canvas state is reaching the prompt.
- **Structure** and **LabelKeywords** should nudge up but not dramatically. The new prompt helps, but they're not the core point of this lesson.

LLMs are non deterministic at temperature > 0 and there's run to run noise even on the same code. Direction and which scorers move matters more than specific digits.

## A note on scorers and what they're really measuring

Improving the agent isn't the only thing we do in this loop. We also improve the evals. Scorers fall into two buckets and the distinction matters more as the agent evolves.

**Output based scorers** look at the final canvas (or final answer, or some end state) and don't care how the agent got there. For us that's Schema, LabelKeywords, and Structure. These tend to survive architecture changes. A regression here means something actually got worse, regardless of which lesson you're on. Invest real care in these.

**Tool coupled scorers** are shaped by the specific tools that exist right now. Their meaning is tied to a particular tool surface, so when the tools change they have to be rewritten or retired.

Preservation is in the second bucket, and honestly it's fundamentally broken in its current form. The two questions we wanted it to answer are "did the agent leave the elements it shouldn't have touched alone?" and "did the agent actually apply the requested change?" It doesn't really answer either of them well. Once `extractElements` simulates the canvas headlessly, any run that doesn't call `generateDiagram` passes Preservation, even one that called `modifyDiagram` with the wrong id or no useful update at all. The scorer became "did the agent avoid regenerating from scratch," which is a useful signal but not what the name promises.

We're leaving it as is. Lesson 7 replaces these tools entirely, which means a new tool surface and a chance to redesign the modify side scoring against the real surface. Fixing a scorer that's about to die one lesson from now is sunk cost.

This brings up the subtlety worth naming. Even when a scorer is imperfect, as long as the **before** and **after** numbers come from the **same** scorer, the **trend is still honest** even if the absolute number is questionable. That's enough to validate the change you made in this lesson. The Preservation jump tells us "putting canvas state in the prompt moved the metric in the right direction." It does not tell us "the agent now preserves canvases X percent of the time" in some absolute sense. Trust the direction, hold the absolute number loosely, and be ready to retire the scorer when the world it was measuring goes away.

## What is next

Lesson 7: **advanced tool use**. The single giant `generateDiagram` tool is too coarse. We'll break it into smaller, focused tools (`addElement`, `updateElement`, `removeElement`, `alignElements`, `queryCanvas`). Each tool does one thing well, the agent makes more, smaller calls, and Structure scores climb because the model isn't doing all its layout math in a single JSON blob anymore.

We'll also introduce a real **client side tool**, `queryCanvas`, that doesn't pay the token cost of serializing the whole canvas every turn. The agent calls it when it actually needs to know about the canvas, and the browser executes the query against the live Excalidraw state.
