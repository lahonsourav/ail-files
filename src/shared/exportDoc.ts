import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
}

// Light markdown cleanup — strips emphasis/heading syntax rather than
// parsing it, since the goal is readable plain text, not a faithful
// markdown render. Shared by the docx export and the presentation builder.
export function stripMarkdownLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*]\s+/, "• ");
}

// Shared by every export route that hands the browser a downloadable file
// named after a user-facing title (conversation title, presentation title).
export function sanitizeFilename(title: string, fallback = "download"): string {
  return title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || fallback;
}

export async function buildDocx(title: string, messages: ExportMessage[]): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
  ];

  for (const m of messages) {
    children.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: m.role === "user" ? "You" : "ail", bold: true })],
      })
    );
    for (const rawLine of m.content.split("\n")) {
      const line = stripMarkdownLine(rawLine);
      children.push(new Paragraph({ text: line || " " }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
