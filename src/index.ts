// ail-files: turn JSON into PowerPoint, PDF, Word and Excel files.
//
//   import { buildPptx, normalizeDeck } from "ail-files";
//   const deck = normalizeDeck(json);            // cleans up input, never throws
//   const bytes = await buildPptx(deck!);        // a Buffer with the .pptx

import { registerCommunityLayouts } from "./layouts/index.js";
// Community layouts are always on, so { "layout": "pricing" } works out of the box.
registerCommunityLayouts();

// PowerPoint
export { buildPptx, FONT_PAIRS, DEFAULT_FONT_PAIR } from "./pptx/presentationBuilder.js";
export type { SlideDeck, SlideContent, FontPairKey, BuildPptxOptions } from "./pptx/presentationBuilder.js";
export { normalizeDeck, extractSlideDeck } from "./pptx/slideDeck.js";
export { EXAMPLE_DECK } from "./pptx/exampleDeck.js";
export { defineLayout, registerLayout, getLayout, listLayouts, BUILTIN_LAYOUT_NAMES } from "./pptx/layoutRegistry.js";
export type { CustomLayout, LayoutContext, LayoutHelpers } from "./pptx/layoutRegistry.js";
export type { ThemeColors } from "./pptx/presentationBuilder.js";
export { COMMUNITY_LAYOUTS, registerCommunityLayouts } from "./layouts/index.js";

// Themes
export { applyTheme, listThemes, getTheme, normalizeTheme } from "./theme/theme.js";
export type { Theme } from "./theme/theme.js";
export { importThemeFromPptx } from "./theme/importPptx.js";

// PDF
export { buildGeneralPdf } from "./pdf/pdfDocBuilder.js";
export type { GeneralPdf, PdfSection, BuildGeneralPdfOptions } from "./pdf/pdfDocBuilder.js";
export { normalizeGeneralPdf } from "./pdf/pdfDocExtract.js";
export { closeBrowser } from "./pdf/htmlToPdf.js";
export { EXAMPLE_PDF } from "./pdf/exampleGeneralPdf.js";

// Word
export { buildGeneralDocx } from "./docx/docxDocBuilder.js";
export type { GeneralDocx, DocxSection, BuildGeneralDocxOptions } from "./docx/docxDocBuilder.js";
export { normalizeGeneralDocx } from "./docx/docxDocExtract.js";
export { EXAMPLE_DOCX } from "./docx/exampleGeneralDocx.js";

// Excel
export { buildGeneralExcel } from "./xlsx/excelBuilder.js";
export type { GeneralExcel, ExcelSheet, BuildGeneralExcelOptions } from "./xlsx/excelBuilder.js";
export { normalizeGeneralExcel } from "./xlsx/excelExtract.js";
export { EXAMPLE_EXCEL } from "./xlsx/exampleGeneralExcel.js";
