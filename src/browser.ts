// ail-files/browser: the parts of the engine that run anywhere, including a web page.
//
//   import { normalizeDeck, extractSlideDeck, IMAGE_LIMITS } from "ail-files/browser";
//
// Only pure code lives here: cleaning up a deck or document from JSON, the picture and logo rules, the recorded
// drawing's types and the examples. Nothing in this entry (or anything it imports) touches Node, `sharp`,
// `pptxgenjs` or the PDF printer, so a bundler can put it in a browser build. test/browser.test.ts checks that.
// Drawing a file (buildPptx and friends), preparing a picture with `sharp` and `recordDeck` are in the main entry, "ail-files".

// Every type, so a browser program can describe a deck, a document or a recording without the builders (types leave no code behind).
export type * from "./pptx/presentationBuilder.js";
export type * from "./pdf/pdfDocBuilder.js";
export * from "./pdf/docPage.js";
export type * from "./docx/docxDocBuilder.js";
export type * from "./xlsx/excelBuilder.js";
export type { ExtractedSlideDeck } from "./pptx/slideDeck.js";

// PowerPoint: clean a deck, find one in a model's reply.
export { normalizeDeck, extractSlideDeck, slideOptionsOf, ILLUSTRATION_ICONS, IMAGE_PLACEMENTS, PHOTO_ARRANGEMENTS } from "./pptx/slideDeck.js";
export * from "./pptx/pptImages.js";
export * from "./pptx/pptLogo.js";
export * from "./pptx/pptRecorded.js";
export { EXAMPLE_DECK, EXAMPLE_PROMPT, EXAMPLE_UPLOADED_FILE } from "./pptx/exampleDeck.js";

// PDF, Word and Excel: clean a document, find one in a model's reply.
export { extractGeneralPdf, normalizeGeneralPdf } from "./pdf/pdfDocExtract.js";
export { extractGeneralDocx, normalizeGeneralDocx } from "./docx/docxDocExtract.js";
export { extractGeneralExcel, normalizeGeneralExcel } from "./xlsx/excelExtract.js";
export { EXAMPLE_PDF, EXAMPLE_PDF_PROMPT } from "./pdf/exampleGeneralPdf.js";
export { EXAMPLE_DOCX, EXAMPLE_DOCX_PROMPT } from "./docx/exampleGeneralDocx.js";
export { EXAMPLE_EXCEL, EXAMPLE_EXCEL_PROMPT } from "./xlsx/exampleGeneralExcel.js";
