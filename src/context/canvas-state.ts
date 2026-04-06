// Serializes the current Excalidraw canvas into a compact human readable
// summary the agent can read in its system prompt. We don't send raw
// Excalidraw JSON because it's huge and the model doesn't need pixel level
// coordinates to make good decisions — it just needs to know what exists,
// what each element is called, and how things are connected.
//
// Used by the worker on every request: it pulls the canvas state off the
// latest user message, runs it through this function, and appends the
// result to the system prompt.

interface ElementLike {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  label?: { text?: unknown };
  startBinding?: { elementId?: unknown };
  endBinding?: { elementId?: unknown };
  containerId?: unknown;
}

function getId(el: ElementLike): string | null {
  return typeof el.id === "string" ? el.id : null;
}

function getType(el: ElementLike): string | null {
  return typeof el.type === "string" ? el.type : null;
}

// Pull a label from either the element's own text field, its bound label
// element's text, or null. Excalidraw uses both shapes depending on how
// the element was created.
function getLabel(el: ElementLike): string | null {
  if (typeof el.text === "string" && el.text.trim()) return el.text.trim();
  if (el.label && typeof el.label.text === "string" && el.label.text.trim()) {
    return el.label.text.trim();
  }
  return null;
}

export function serializeCanvasState(elements: unknown[]): string {
  if (!Array.isArray(elements) || elements.length === 0) {
    return "Canvas is empty.";
  }

  const els = elements as ElementLike[];

  // Build a map from id to a short reference string so arrows can describe
  // their endpoints by label instead of opaque ids.
  const refById = new Map<string, string>();
  for (const el of els) {
    const id = getId(el);
    const type = getType(el);
    if (!id || !type) continue;
    const label = getLabel(el);
    refById.set(id, label ? `${id} ("${label}")` : id);
  }

  // Resolve text elements that are bound to a container into the container's
  // label so we don't double count them in the listing.
  const consumedTextIds = new Set<string>();
  for (const el of els) {
    const containerId = el.containerId;
    if (typeof containerId === "string") {
      const id = getId(el);
      if (id) consumedTextIds.add(id);
    }
  }

  const lines: string[] = [];
  const counts: Record<string, number> = {};

  for (const el of els) {
    const id = getId(el);
    const type = getType(el);
    if (!id || !type) continue;
    if (consumedTextIds.has(id)) continue;
    counts[type] = (counts[type] ?? 0) + 1;

    if (type === "arrow" || type === "line") {
      const fromId =
        typeof el.startBinding?.elementId === "string"
          ? el.startBinding.elementId
          : null;
      const toId =
        typeof el.endBinding?.elementId === "string"
          ? el.endBinding.elementId
          : null;
      const from = fromId ? refById.get(fromId) ?? fromId : "(unbound)";
      const to = toId ? refById.get(toId) ?? toId : "(unbound)";
      lines.push(`- ${type} ${id}: ${from} → ${to}`);
    } else {
      const label = getLabel(el);
      lines.push(label ? `- ${type} ${id} "${label}"` : `- ${type} ${id}`);
    }
  }

  const summary = Object.entries(counts)
    .map(([type, n]) => `${n} ${type}${n === 1 ? "" : "s"}`)
    .join(", ");

  return `Canvas contains ${summary}:\n${lines.join("\n")}`;
}
