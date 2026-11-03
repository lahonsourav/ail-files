import type { CanvasTextSize } from "./presentationBuilder.js";

// Sizes the PowerPoint builder and the editing code both need, kept in a file with no heavy imports so a browser can use it.

/** The point size of each named text size on a free-form slide. */
export const CANVAS_TEXT_SIZE_PT: Record<CanvasTextSize, number> = { xl: 36, lg: 24, md: 16, sm: 12, xs: 9.5 };
