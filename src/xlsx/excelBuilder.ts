import ExcelJS from "exceljs";

// General-purpose spreadsheet renderer for the Excel Maker plugin/domain.
// Unlike PDF/DOCX Maker's free-form document sections, a spreadsheet's
// content is inherently tabular — the schema here is sheets of real tables,
// not headings/paragraphs/bullets, since a budget, tracker, or comparison
// sheet doesn't naturally decompose into prose sections.
export interface ExcelHeaderGroup {
  label: string;
  span: number;
}

export interface ExcelSheet {
  name?: string;
  // Optional second, higher-level header row above `headers` — each entry
  // is a merged cell spanning `span` of the sub-columns below it (e.g. one
  // "Q1" group spanning three "Jan"/"Feb"/"Mar" sub-column headers). Spans
  // must sum to `headers.length`; omit entirely for a normal single-row
  // header, which is most sheets.
  headerGroups?: ExcelHeaderGroup[];
  headers?: string[];
  rows: string[][];
  // 6-digit hex (no leading #), same convention as the deck's
  // background/accent fields in lib/presentationBuilder.ts — tints the
  // header row's fill, with white header text for contrast. Undefined means
  // "no color," not "pick one for me" (unlike the deck, which always picks
  // a default) — a spreadsheet reads as a working document more often than
  // a presentation does, so plain-with-bold-headers stays the default look;
  // color is opt-in when the user actually describes wanting one.
  headerColor?: string;
  // Parallel to `rows` — a 6-digit hex (or "" for no tint) per row, letting
  // rows that fall into different natural groups (income vs. expense,
  // pass vs. fail, by status/category) read as differently-colored sections
  // at a glance, the way a hand-formatted spreadsheet would. Omit the whole
  // array, or leave an entry "", when rows don't have a natural grouping.
  rowColors?: string[];
  // Parallel to `rows` — Excel's native outline/grouping level per row (0 =
  // normal top-level row, 1+ = a nested "subrow" that collapses/expands
  // under the nearest following level-0 row, e.g. individual expense lines
  // collapsing under their category's total row). Omit entirely for a flat
  // sheet with no grouping, which is most sheets.
  rowGroupLevels?: number[];
}

export interface GeneralExcel {
  title: string;
  sheets?: ExcelSheet[];
}

// Excel sheet names can't exceed 31 characters or contain \/*?:[]  — trims
// and strips rather than letting ExcelJS throw on a model-generated name.
function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, "").trim().slice(0, 31);
  return cleaned || `Sheet ${index + 1}`;
}

// 6-digit hex only (no leading #) — anything else (a bad model value, or a
// deliberately empty "" meaning "no color for this row") is treated as
// absent rather than passed through to ExcelJS, which would throw on it.
function hexToArgb(hex: string | undefined): string | null {
  return hex && /^[0-9A-Fa-f]{6}$/.test(hex) ? `FF${hex.toUpperCase()}` : null;
}

const THIN_GRAY: ExcelJS.Border = { style: "thin", color: { argb: "FFD1D5DB" } };
const CELL_BORDERS: Partial<ExcelJS.Borders> = { top: THIN_GRAY, bottom: THIN_GRAY, left: THIN_GRAY, right: THIN_GRAY };

// A cell that's purely a number (optionally with commas/a decimal/a leading
// -) reads better right-aligned, same convention every spreadsheet tool
// applies automatically — done here since raw values arrive as strings
// (matching PDF/DOCX Maker's table cells), so ExcelJS never infers it itself.
const NUMERIC_RE = /^-?[\d,]+(\.\d+)?%?$/;

export interface BuildGeneralExcelOptions {
  // Export-time rendering preference, not workbook content — same reasoning
  // as PDF/DOCX Maker's export-time toggles. Defaults on.
  boldHeaders?: boolean;
}

export async function buildGeneralExcel(data: GeneralExcel, opts?: BuildGeneralExcelOptions): Promise<Buffer> {
  const boldHeaders = opts?.boldHeaders !== false;
  const workbook = new ExcelJS.Workbook();
  workbook.title = data.title;

  const sheets = data.sheets && data.sheets.length > 0 ? data.sheets : [{ rows: [] as string[][] }];

  sheets.forEach((sheet, i) => {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheet.name ?? `Sheet ${i + 1}`, i));
    const colCount = sheet.headers?.length ?? sheet.rows[0]?.length ?? 0;
    const argb = hexToArgb(sheet.headerColor);

    function styleHeaderCell(cell: ExcelJS.Cell) {
      if (boldHeaders) cell.font = { bold: true, color: argb ? { argb: "FFFFFFFF" } : undefined };
      if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      cell.border = CELL_BORDERS;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }

    // Group header row — spans must exactly cover every sub-column or it's
    // ambiguous which cells to merge, so a mismatched total falls back to
    // no group row at all rather than guessing.
    const groupSpanTotal = sheet.headerGroups?.reduce((s, g) => s + g.span, 0) ?? 0;
    const validHeaderGroups = sheet.headerGroups && sheet.headers && groupSpanTotal === sheet.headers.length ? sheet.headerGroups : null;
    if (validHeaderGroups) {
      const groupRow = worksheet.addRow(validHeaderGroups.map((g) => g.label));
      let col = 1;
      for (const g of validHeaderGroups) {
        if (g.span > 1) worksheet.mergeCells(groupRow.number, col, groupRow.number, col + g.span - 1);
        col += g.span;
      }
      groupRow.eachCell(styleHeaderCell);
    }

    if (sheet.headers) {
      const headerRow = worksheet.addRow(sheet.headers);
      headerRow.eachCell(styleHeaderCell);
    }
    sheet.rows.forEach((row, r) => {
      const dataRow = worksheet.addRow(row);
      const rowArgb = hexToArgb(sheet.rowColors?.[r]);
      const groupLevel = sheet.rowGroupLevels?.[r];
      if (typeof groupLevel === "number" && groupLevel > 0) dataRow.outlineLevel = Math.min(7, Math.floor(groupLevel));
      dataRow.eachCell((cell) => {
        cell.border = CELL_BORDERS;
        if (rowArgb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowArgb } };
        if (typeof cell.value === "string" && NUMERIC_RE.test(cell.value.trim())) cell.alignment = { horizontal: "right" };
      });
    });

    // Auto-size columns from actual content width rather than a fixed
    // guess — capped so one long cell can't blow the sheet out.
    for (let c = 0; c < colCount; c++) {
      const header = sheet.headers?.[c]?.length ?? 0;
      const longestCell = Math.max(header, ...sheet.rows.map((r) => r[c]?.length ?? 0));
      worksheet.getColumn(c + 1).width = Math.min(40, Math.max(10, longestCell + 2));
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
