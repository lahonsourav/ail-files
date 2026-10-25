import type { GeneralExcel } from "./excelBuilder.js";

// Fixed marketing sample shown on /domain/excel_maker — same idea as
// lib/exampleGeneralPdf.ts for PDF Maker: a real, deterministic render of
// actual product output, not a mockup. Deliberately exercises every Excel
// Maker feature — a long sheet with native row grouping (category totals
// collapsing their line items), a second sheet with merged sub-column
// headers, and color-coding on both — rather than a toy example that only
// shows one feature at a time.
export const EXAMPLE_EXCEL_PROMPT =
  "Make me a detailed household budget spreadsheet — group expense items under their category totals, add a quarterly trend sheet with monthly sub-columns, and color-code everything.";

// Soft pastel tints (D1FAE5/FEE2E2/DBEAFE) reused from this app's own
// design-system.css light-theme palette (emerald-900/red-900/indigo accent
// dim) rather than invented hex values — keeps the demo visually consistent
// with the rest of the product.
const INCOME_TINT = "D1FAE5";
const EXPENSE_TINT = "FEE2E2";
const SAVINGS_TINT = "DBEAFE";
const CATEGORY_TINT = "E0E7FF"; // indigo-100-ish — marks a category's own total row apart from its line-item subrows

export const EXAMPLE_EXCEL: GeneralExcel = {
  title: "Monthly Household Budget",
  sheets: [
    {
      name: "Budget",
      headers: ["Category", "Item", "Amount (₹)"],
      headerColor: "2563EB",
      rows: [
        ["Income", "", "73000"],
        ["", "Salary", "65000"],
        ["", "Freelance", "8000"],
        ["Housing", "", "18000"],
        ["", "Rent", "18000"],
        ["Food", "", "9000"],
        ["", "Groceries", "6000"],
        ["", "Dining Out", "3000"],
        ["Transport", "", "5500"],
        ["", "Fuel", "3000"],
        ["", "Public Transit", "1500"],
        ["", "Ride-hailing", "1000"],
        ["Utilities", "", "3500"],
        ["", "Electricity", "2000"],
        ["", "Internet", "1500"],
        ["Entertainment", "", "2500"],
        ["", "Streaming", "800"],
        ["", "Dining & Movies", "1700"],
        ["Savings", "", "10000"],
        ["", "Emergency Fund", "10000"],
      ],
      rowColors: [
        CATEGORY_TINT, "", "",
        CATEGORY_TINT, "",
        CATEGORY_TINT, "", "",
        CATEGORY_TINT, "", "", "",
        CATEGORY_TINT, "", "",
        CATEGORY_TINT, "", "",
        CATEGORY_TINT, "",
      ],
      // Each category's own total row stays level 0; its line items collapse
      // beneath it as level-1 subrows — Excel's native row grouping.
      rowGroupLevels: [
        0, 1, 1,
        0, 1,
        0, 1, 1,
        0, 1, 1, 1,
        0, 1, 1,
        0, 1, 1,
        0, 1,
      ],
    },
    {
      name: "Quarterly Trend",
      headerColor: "059669",
      headerGroups: [
        { label: "", span: 1 },
        { label: "Q1", span: 3 },
        { label: "Q2", span: 3 },
      ],
      headers: ["Category", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      rows: [
        ["Income", "73000", "74000", "75000", "76000", "77000", "78000"],
        ["Expenses", "33000", "34000", "32000", "35000", "33000", "36000"],
        ["Net Savings", "40000", "40000", "43000", "41000", "44000", "42000"],
      ],
      rowColors: [INCOME_TINT, EXPENSE_TINT, SAVINGS_TINT],
    },
    {
      name: "Summary",
      headers: ["Metric", "Value (₹)"],
      headerColor: "059669",
      rows: [
        ["Total Income", "73000"],
        ["Total Expenses", "33000"],
        ["Net Savings", "40000"],
      ],
      rowColors: [INCOME_TINT, EXPENSE_TINT, SAVINGS_TINT],
    },
  ],
};
