import { registerLayout, type CustomLayout } from "../pptx/layoutRegistry.js";
import { pricing } from "./pricing.js";

// Every community layout is listed here. To add yours: put the file in this
// folder, import it, and add it to the array.
export const COMMUNITY_LAYOUTS: CustomLayout<unknown>[] = [pricing];

/** Makes the community layouts available to decks. Safe to call more than once. */
export function registerCommunityLayouts(): void {
  for (const layout of COMMUNITY_LAYOUTS) registerLayout(layout);
}
