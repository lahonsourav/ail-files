// What changed between two versions of a slide, in a short sentence the editor can say aloud after "Ask" in talk mode ("Done. I changed
// the title and the layout."). It compares the slide's own fields, so it costs nothing and is instant: no second model call.

const LOOK = new Set(["background", "backgroundImage", "accent", "fontPair", "tone", "pageNumber", "logo", "size"]);
const PLACEMENT = new Set(["pictures", "elements", "image", "images"]);
const NAMED: Record<string, string> = { layout: "the layout", title: "the title", subtitle: "the subtitle", heading: "the heading", notes: "the notes", icon: "the icon", caption: "the caption" };

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** "Done. I changed the title and the text." Never longer than three things, and always a sentence that is safe to say aloud. */
export function describeChange(before: unknown, after: unknown): string {
  const a = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const b = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const things: string[] = [];
  const add = (t: string) => {
    if (!things.includes(t)) things.push(t);
  };
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (same(a[key], b[key])) continue;
    if (NAMED[key]) add(NAMED[key]);
    else if (LOOK.has(key)) add("how it looks");
    else if (PLACEMENT.has(key)) add("the pictures");
    else add("the text");
  }
  if (things.length === 0) return "I didn't change anything on this slide.";
  const shown = things.slice(0, 3);
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return `Done. I changed ${list}.`;
}
