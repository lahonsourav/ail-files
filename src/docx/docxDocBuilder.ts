import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  Footer, PageNumber, LevelFormat, PageBorderOffsetFrom,
} from "docx";

// General-purpose Word document renderer for the DOCX Maker plugin/domain —
// same role as lib/pdfDocBuilder.ts's buildGeneralPdf, just a different
// container format. Sections are a free-form mix of
// heading/paragraphs/bullets/numbered/table, covering letters, reports,
// proposals, meeting notes, and simple invoice-style sheets — the schema is
// intentionally identical in shape to lib/pdfDocBuilder.ts's GeneralPdf so
// the model doesn't need a second mental model for "a document," just a
// second file format to emit it as.
export interface DocxTable {
  headers?: string[];
  rows: string[][];
}

export interface DocxSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  table?: DocxTable;
  // Forces this section to start on a fresh page (ignored on the very
  // first section, which is already on page 1) — same mechanism and
  // reasoning as lib/pdfDocBuilder.ts's PdfSection.newPage.
  newPage?: boolean;
}

export interface GeneralDocx {
  title: string;
  subtitle?: string;
  sections?: DocxSection[];
}

const NUMBERING_REFERENCE = "general-docx-numbered-list";
const GRAY = "666666";
const BORDER_GRAY = "AAAAAA";

// Page-border geometry: a real, explicit page margin plus offsetFrom:PAGE
// (border measured from the physical page edge, not Word's own default of
// "from text") gives two independently controllable gaps instead of
// relying on whatever margin/offset a viewer implicitly defaults to —
// PAGE_MARGIN_TWIPS (1440 = 1in, matching Word's own standard default) is
// the page-edge-to-text distance, and BORDER_SPACE_PT is how far inside
// that the border itself sits, leaving (margin - space) = 48pt as the
// real gap between the border and the text on every side.
const PAGE_MARGIN_TWIPS = 1440;
const BORDER_SPACE_PT = 24;

function buildTable(table: DocxTable): Table {
  const colCount = table.headers?.length ?? table.rows[0]?.length ?? 0;
  const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  function cell(text: string, bold: boolean): TableCell {
    return new TableCell({
      borders,
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });
  }

  const rows: TableRow[] = [];
  if (table.headers) rows.push(new TableRow({ children: table.headers.map((h) => cell(h, true)) }));
  for (const row of table.rows) rows.push(new TableRow({ children: row.map((c) => cell(c, false)) }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colCount > 0 ? Array(colCount).fill(Math.floor(9000 / colCount)) : undefined,
    rows,
  });
}

export interface BuildGeneralDocxOptions {
  // Export-time rendering preferences, not document content — same
  // reasoning as lib/pdfDocBuilder.ts's BuildGeneralPdfOptions. pageNumbers
  // defaults on, border defaults off.
  pageNumbers?: boolean;
  border?: boolean;
}

export async function buildGeneralDocx(data: GeneralDocx, opts?: BuildGeneralDocxOptions): Promise<Buffer> {
  const showPageNumbers = opts?.pageNumbers !== false;
  const showBorder = opts?.border === true;

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.TITLE }),
  ];
  if (data.subtitle?.trim()) {
    children.push(new Paragraph({ children: [new TextRun({ text: data.subtitle.trim(), italics: true, color: GRAY })] }));
  }

  data.sections?.forEach((section, i) => {
    // Ignored on the very first section — it's already on page 1, nothing
    // to break away from. Applied to whichever element actually renders
    // first for this section (heading, else the first paragraph/bullet/
    // numbered item, else — since Table has no pageBreakBefore of its own
    // in OOXML — a standalone empty paragraph carrying the break.
    let pendingBreak = section.newPage === true && i !== 0;
    const consumeBreak = () => {
      if (!pendingBreak) return false;
      pendingBreak = false;
      return true;
    };

    if (section.heading?.trim()) {
      children.push(new Paragraph({ text: section.heading.trim(), heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 }, pageBreakBefore: consumeBreak() }));
    }
    for (const p of section.paragraphs ?? []) {
      children.push(new Paragraph({ text: p, spacing: { after: 120 }, pageBreakBefore: consumeBreak() }));
    }
    for (const b of section.bullets ?? []) {
      children.push(new Paragraph({ text: b, bullet: { level: 0 }, spacing: { after: 60 }, pageBreakBefore: consumeBreak() }));
    }
    for (const n of section.numbered ?? []) {
      children.push(new Paragraph({ text: n, numbering: { reference: NUMBERING_REFERENCE, level: 0 }, spacing: { after: 60 }, pageBreakBefore: consumeBreak() }));
    }
    if (section.table && section.table.rows.length > 0) {
      if (consumeBreak()) children.push(new Paragraph({ text: "", pageBreakBefore: true }));
      children.push(buildTable(section.table));
      children.push(new Paragraph({ text: "" }));
    }
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: showBorder
            ? {
                margin: { top: PAGE_MARGIN_TWIPS, bottom: PAGE_MARGIN_TWIPS, left: PAGE_MARGIN_TWIPS, right: PAGE_MARGIN_TWIPS },
                borders: {
                  pageBorders: { offsetFrom: PageBorderOffsetFrom.PAGE },
                  pageBorderTop: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: BORDER_SPACE_PT },
                  pageBorderBottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: BORDER_SPACE_PT },
                  pageBorderLeft: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: BORDER_SPACE_PT },
                  pageBorderRight: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: BORDER_SPACE_PT },
                },
              }
            : undefined,
        },
        footers: showPageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: GRAY, size: 18 }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
