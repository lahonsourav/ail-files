// Lays a document's page out as separate sheets of paper, the way the PDF prints it, for the editor's preview.
// The PDF maker's HTML is one long flow; the printer (Chromium) cuts it into pages, which the editor cannot ask for. This does the same
// cut in the browser: it moves the parts of the document, one after another, onto A4 sheets and starts a new sheet when the next part
// no longer fits. A section that does not fit is cut between its own parts (a paragraph, a list item, a table row), the heading is not
// left alone at the foot of a sheet, a "new page" section starts a sheet, and a part taller than a whole sheet gets a taller sheet
// instead of being cut. It is close to what the printer does, not identical (the printer can also cut inside a paragraph).

import { pageNumberText, type NumberFormat, type NumberPosition } from "../pdf/docPage.js";

export const PAGE_PX = 794; // A4 at 96 dpi
export const PAGE_HEIGHT = 1123;

/** The margins of a sheet in pixels and how its page number looks (see previewGeometry in ../pdf/docPage.ts). */
export interface SheetGeometry {
  top: number;
  bottom: number;
  side: number;
  showNumbers: boolean;
  numberAlign: NumberPosition;
  numberFormat: NumberFormat;
}

/** The height a sheet's content may use. */
export const contentHeight = (g: Pick<SheetGeometry, "top" | "bottom">) => PAGE_HEIGHT - g.top - g.bottom;

const listLike = (el: Element) => el.tagName === "UL" || el.tagName === "OL";

/** Puts `source`'s children onto sheets inside `pagesEl`, and returns how many sheets there are. `source` is emptied. */
export function paginate(pagesEl: HTMLElement, source: HTMLElement, bodyClass: string, geometry: SheetGeometry): number {
  const CONTENT_HEIGHT = contentHeight(geometry);
  const doc = pagesEl.ownerDocument;
  pagesEl.textContent = "";
  let page!: HTMLElement;
  let count = 0;

  const newPage = () => {
    const wrap = doc.createElement("div");
    wrap.className = "sheet-wrap";
    const sheet = doc.createElement("div");
    sheet.className = "sheet";
    page = doc.createElement("div");
    page.className = `page ${bodyClass}`.trim();
    sheet.appendChild(page);
    const label = doc.createElement("div");
    label.className = "pageno";
    label.textContent = `Page ${++count}`;
    wrap.append(sheet, label);
    pagesEl.appendChild(wrap);
  };
  const overflows = () => page.offsetHeight > CONTENT_HEIGHT + 0.5;
  newPage();

  // A part (a copy of the section's own element, without its contents) holds the pieces of one section that sit on the current sheet.
  let part: HTMLElement | null = null;
  const startPart = (section: HTMLElement, continued: boolean) => {
    part = section.cloneNode(false) as HTMLElement;
    if (continued) part.classList.add("cont");
    page.appendChild(part);
  };
  const isHeading = (el: Element) => el.tagName === "H2" || el.tagName === "H3";

  // The sheet is full: go on at the top of a new one, taking a lone heading along so it does not end a sheet.
  const nextSheet = (section: HTMLElement) => {
    const current = part;
    let carry: Element | null = null;
    if (current && current.children.length === 1 && isHeading(current.children[0])) {
      carry = current.children[0];
      current.remove();
    }
    newPage();
    startPart(section, true);
    if (carry) part!.appendChild(carry);
  };

  const emptyOtherwise = (el: Element) => page.children.length === 1 && part !== null && part.children.length === 1 && part.children[0] === el;

  // A list or a table that is too tall for what is left of the sheet goes across sheets, item by item, a table keeping its header row.
  const splitAcross = (section: HTMLElement, block: HTMLElement) => {
    const isTable = block.tagName === "TABLE";
    const body = isTable ? (block.querySelector("tbody") ?? block) : block;
    const rows = Array.from(body.children);
    const head = isTable ? block.querySelector("thead") : null;
    const piece = (): { shell: HTMLElement; into: HTMLElement } => {
      const shell = block.cloneNode(false) as HTMLElement;
      let into: HTMLElement = shell;
      if (isTable) {
        if (head) shell.appendChild(head.cloneNode(true));
        into = doc.createElement("tbody");
        shell.appendChild(into);
      }
      return { shell, into };
    };
    let current = piece();
    part!.appendChild(current.shell);
    let numbered = block.tagName === "OL" ? Number(block.getAttribute("start") ?? 1) : 0;
    let placed = 0;
    for (const row of rows) {
      current.into.appendChild(row);
      if (overflows() && placed > 0) {
        current.into.removeChild(row);
        nextSheet(section);
        current = piece();
        if (numbered) current.shell.setAttribute("start", String(numbered));
        part!.appendChild(current.shell);
        current.into.appendChild(row);
        placed = 0;
      }
      placed++;
      if (numbered) numbered++;
    }
  };

  const addBlock = (section: HTMLElement, block: HTMLElement) => {
    part!.appendChild(block);
    if (!overflows()) return;
    // Alone on its sheet and still too tall: leave it, and the sheet grows.
    if (emptyOtherwise(block)) return;
    const splittable = (listLike(block) && block.children.length > 1) || (block.tagName === "TABLE" && (block.querySelector("tbody") ?? block).children.length > 1);
    if (splittable) {
      part!.removeChild(block);
      // Starting a table or list at the foot of a sheet with room for none of it is not worth it: begin it on the next sheet.
      splitAcross(section, block);
      return;
    }
    part!.removeChild(block);
    nextSheet(section);
    part!.appendChild(block);
  };

  for (const node of Array.from(source.children)) {
    const el = node as HTMLElement;
    if (el.tagName !== "SECTION") {
      page.appendChild(el);
      if (overflows() && page.children.length > 1) {
        page.removeChild(el);
        newPage();
        page.appendChild(el);
      }
      continue;
    }
    // "New page": a sheet of its own start, with no dashed line, since the sheets are already apart.
    const forced = el.classList.contains("page-break");
    el.classList.remove("page-break");
    if (forced && page.children.length > 0) newPage();
    startPart(el, false);
    const blocks = Array.from(el.children) as HTMLElement[];
    if (blocks.length === 0) {
      if (overflows() && page.children.length > 1) {
        part!.remove();
        newPage();
        startPart(el, false);
      }
      continue;
    }
    for (const block of blocks) addBlock(el, block);
    part = null;
  }
  // The frame of every sheet but the last runs the full height of the page, since the document goes on over it; the last one ends with the text,
  // as in the PDF (the printer clones the frame onto each page of the document, and the last page's piece is only as tall as what is on it).
  (pagesEl.lastElementChild?.querySelector(".page") as HTMLElement | null)?.style.setProperty("min-height", "0");
  // The page number, where the PDF puts it: in the bottom margin, below the frame. (Without numbers the editor's own "Page 2" label stays.)
  if (geometry.showNumbers) {
    const wraps = Array.from(pagesEl.children) as HTMLElement[];
    wraps.forEach((wrap, i) => {
      wrap.querySelector(".pageno")?.remove();
      const n = doc.createElement("div");
      n.className = `pnum pnum-${geometry.numberAlign}`;
      n.textContent = pageNumberText(geometry.numberFormat, i + 1, wraps.length);
      wrap.querySelector(".sheet")?.appendChild(n);
    });
  }
  return count;
}
