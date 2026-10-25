import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { buildGeneralPdf } from "../src/pdf/pdfDocBuilder.js";
import { htmlToPdfBuffer, getBrowser, closeBrowser } from "../src/pdf/htmlToPdf.js";
import { renderGeneralPdfHtml } from "../src/pdf/pdfDocHtml.js";

// The PDF renderer is a real browser fed text that can come from an AI or a
// stranger. These tests prove it cannot be made to fetch anything: a local
// server stands in for "the internal network" and must never be contacted.

let server: Server;
let hits: string[] = [];
let base = "";
let haveChromium = true;

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? "");
    res.end("x");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await getBrowser();
  } catch {
    haveChromium = false;
  }
});

afterAll(async () => {
  await closeBrowser();
  await new Promise((r) => server.close(r));
});

describe("PDF renderer lockdown", () => {
  it("blocks every request the page tries to make", async (ctx) => {
    if (!haveChromium) return ctx.skip();
    hits = [];
    const html = `<html><head>
      <link rel="stylesheet" href="${base}/css">
      <style>@import url("${base}/import"); body{background:url(${base}/bg)}</style>
      <script src="${base}/script"></script>
    </head><body>
      <img src="${base}/img"><iframe src="${base}/frame"></iframe>
      <iframe src="file:///etc/passwd"></iframe>
      <object data="${base}/object"></object>
      <video src="${base}/video"></video>
      <script>fetch("${base}/fetch")</script>
      <p>ok</p></body></html>`;
    const pdf = await htmlToPdfBuffer(html);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(hits).toEqual([]);
  });

  it("does not turn hostile document text into markup", async (ctx) => {
    if (!haveChromium) return ctx.skip();
    hits = [];
    const evil = `<img src="${base}/a"><script>fetch("${base}/b")</script><iframe src="${base}/c"></iframe>`;
    const doc = {
      title: evil,
      subtitle: evil,
      sections: [
        {
          heading: evil,
          paragraphs: [evil, `[click](${base}/d) ![x](${base}/e)`],
          bullets: [evil],
          table: { headers: [evil], rows: [[evil]] },
          callout: { text: evil },
          chart: { type: "bar" as const, title: evil, data: [{ label: evil, value: 1 }] },
        },
      ],
    };
    const html = renderGeneralPdfHtml(doc);
    expect(html).not.toMatch(/<img[^>]+src=["']?http/i);
    expect(html).not.toMatch(/<script[^>]*>fetch/i);
    expect(html).not.toMatch(/<iframe/i);
    const pdf = await buildGeneralPdf(doc);
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(hits).toEqual([]);
  });
});
