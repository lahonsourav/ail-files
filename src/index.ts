// ail-files: turn JSON into PowerPoint, PDF, Word and Excel files.
//
//   import { buildPptx, normalizeDeck } from "ail-files";
//   const deck = normalizeDeck(json);            // cleans up input, never throws
//   const bytes = await buildPptx(deck!);        // a Buffer with the .pptx

import { registerCommunityLayouts } from "./layouts/index.js";
// Community layouts are always on, so { "layout": "pricing" } works out of the box.
registerCommunityLayouts();

// Everything that also works in a browser (see browser.ts): cleaning up decks and documents, the picture and logo rules, the
// recorded drawing's types, the examples and every type.
export * from "./browser.js";

// PowerPoint
export { buildPptx, recordDeck, slidePalette, FONT_PAIRS, DEFAULT_FONT_PAIR } from "./pptx/presentationBuilder.js";

// The user's own logo and pictures. Both are export-time options (`buildPptx(deck, { logo, images })`), prepared first with
// `prepareLogo` / `prepareImages` (checks the type and size, and reads the pixel size), and a deck names a picture by id (img1, img2...).
export { prepareLogo } from "./pptx/pptLogoImage.js";
export { prepareImages } from "./pptx/pptImagesPrepare.js";

/**
 * Options this release has that an older one may not. A program that needs one of them can check this list before relying on it.
 */
export const features = ["pptx.logo", "pptx.images"] as const;

// Layouts
export { defineLayout, registerLayout, getLayout, listLayouts, BUILTIN_LAYOUT_NAMES } from "./pptx/layoutRegistry.js";
export type { CustomLayout, LayoutContext, LayoutHelpers } from "./pptx/layoutRegistry.js";
export { COMMUNITY_LAYOUTS, registerCommunityLayouts } from "./layouts/index.js";

// Themes
export { applyTheme, listThemes, getTheme, normalizeTheme } from "./theme/theme.js";
export type { Theme } from "./theme/theme.js";
export { importThemeFromPptx } from "./theme/importPptx.js";

// PDF
export { buildGeneralPdf } from "./pdf/pdfDocBuilder.js";
export { closeBrowser } from "./pdf/htmlToPdf.js";
// The pieces the PDF is made from, for a program that draws the same sections itself (the Ail app's other PDF exports).
export { renderGeneralPdfHtml } from "./pdf/pdfDocHtml.js";
export { renderBarChartSvg, renderPieChartSvg, renderPieLegend, computePieSlices, arcPath } from "./pdf/pdfDocCharts.js";
export { escapeHtml, renderTextWithMath, getInlinedKatexCss } from "./pdf/pdfMath.js";

// Word
export { buildGeneralDocx } from "./docx/docxDocBuilder.js";

// Excel
export { buildGeneralExcel } from "./xlsx/excelBuilder.js";

