import { renderGeneralPdfHtml } from "./pdfDocHtml.js";
import { htmlToPdfBuffer } from "./htmlToPdf.js";
import type { DocLogoPlace, DocPictureMap, DocPictureSize } from "./docPictures.js";

// General-purpose document renderer for the PDF Maker plugin/domain —
// distinct from lib/resumeBuilder.ts's fixed resume schema. Sections are a
// free-form mix of heading/paragraphs/bullets/numbered/table, covering
// letters, reports, proposals, meeting notes, and simple invoice-style
// sheets. Rendered via lib/pdfDocHtml.ts (HTML/CSS) and lib/htmlToPdf.ts
// (headless Chromium) rather than drawing directly with pdf-lib — see
// those files for the actual layout/typography and print pipeline.
export interface PdfTable {
  headers?: string[];
  rows: string[][];
}

export interface PdfChartSeries {
  label: string;
  value: number;
}

export type PdfChartType = "bar" | "pie";

export interface PdfChart {
  type: PdfChartType;
  title?: string;
  data: PdfChartSeries[]; // 1-8 entries
}

export type PdfCalloutKind = "note" | "warning" | "important";

export interface PdfCallout {
  kind?: PdfCalloutKind;
  text: string;
}

export interface PdfColumnBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface PdfColumns {
  left: PdfColumnBlock;
  right: PdfColumnBlock;
}

export interface PdfPicture {
  // One of the person's pictures ("img1" to "img6"); drawn from the `pictures` option of the build.
  image: string;
  caption?: string;
  size?: DocPictureSize;
}

export interface PdfSection {
  heading?: string;
  paragraphs?: string[];
  pictures?: PdfPicture[];
  bullets?: string[];
  numbered?: string[];
  table?: PdfTable;
  chart?: PdfChart;
  callout?: PdfCallout;
  columns?: PdfColumns;
  // Forces this section to start on a fresh page (ignored on the very
  // first section, which is already on page 1) — the mechanism for
  // hitting an exact/specific page count deterministically, the same way
  // an exact slide count comes from the model emitting exactly that many
  // entries in "slides" for a deck. See the generation prompt's fullGeneralPdfSuffix.
  newPage?: boolean;
  // Which section of an editor this is; set only when drawing a preview with `anchors`.
  anchor?: number;
}

export interface GeneralPdf {
  title: string;
  subtitle?: string; // e.g. a date, "Prepared for Acme Corp", a reference number
  // Where the person's logo sits at the top of the first page. Set by the document editor; the logo's pixels come in as `pictures.logo`.
  logo?: DocLogoPlace;
  sections?: PdfSection[];
}

export interface BuildGeneralPdfOptions {
  // Export-time rendering preferences, not document content.
  // pageNumbers defaults on, border defaults off (a decorative frame is
  // more of an opt-in choice than an expected default for a plain
  // letter/report).
  pageNumbers?: boolean;
  border?: boolean;
  // The person's pictures by id ("img1" to "img6", and "logo"), for the pictures and logo a document names.
  pictures?: DocPictureMap;
}

export async function buildGeneralPdf(data: GeneralPdf, opts?: BuildGeneralPdfOptions): Promise<Uint8Array> {
  const html = renderGeneralPdfHtml(data, { border: opts?.border === true, pictures: opts?.pictures });
  return htmlToPdfBuffer(html, { pageNumbers: opts?.pageNumbers !== false });
}
