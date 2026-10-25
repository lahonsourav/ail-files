import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, type Browser } from "playwright-core";

// Finding a Chromium to print with: PDF_CHROMIUM_PATH wins, then a sandbox
// path some CI images ship, then a chromium/chrome binary on PATH.
const SANDBOX_CHROMIUM_PATH = "/opt/pw-browsers/chromium";

function resolveChromiumExecutable(): string {
  if (process.env.PDF_CHROMIUM_PATH) return process.env.PDF_CHROMIUM_PATH;
  if (existsSync(SANDBOX_CHROMIUM_PATH)) return SANDBOX_CHROMIUM_PATH;
  for (const bin of ["chromium", "chromium-browser", "google-chrome-stable"]) {
    try {
      const resolved = execFileSync("which", [bin], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (resolved) return resolved;
    } catch {
      // not on PATH, try the next candidate
    }
  }
  throw new Error(
    "Could not locate a Chromium executable for PDF rendering. Set PDF_CHROMIUM_PATH or install chromium.",
  );
}

// Module-level lazy singleton — this is meant for a long-running server process,
// not serverless, so one long-lived browser process safely serves many
// concurrent contexts rather than launching Chromium per request.
let browserPromise: Promise<Browser> | null = null;
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ executablePath: resolveChromiumExecutable(), args: ["--no-sandbox", "--disable-setuid-sandbox"] })
      .then((b) => {
        b.on("disconnected", () => {
          browserPromise = null;
        });
        return b;
      })
      .catch((e) => {
        browserPromise = null;
        throw e;
      });
  }
  return browserPromise;
}

/** Closes the shared browser. Call it when a script is done, or Node stays alive waiting on it. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close();
}

export interface HtmlToPdfOptions {
  pageNumbers?: boolean;
}

// page.pdf()'s margin option only accepts px/in/cm/mm, not the "pt" unit
// used everywhere else in this file's CSS — 50pt/72 and 60pt/72 in inches.
const CONTENT_MARGIN = "0.694in";
const FOOTER_MARGIN = "0.833in";
const FOOTER_STYLE = "width:100%; font-size:8.5pt; color:#666666; text-align:center; font-family:'DejaVu Sans','Liberation Sans',Arial,sans-serif;";

export async function htmlToPdfBuffer(html: string, opts: HtmlToPdfOptions = {}): Promise<Uint8Array> {
  const showPageNumbers = opts.pageNumbers !== false;
  const browser = await getBrowser();
  // The HTML is fully self-contained and needs no scripting — disable JS
  // categorically, and block every request that isn't the document itself,
  // since GeneralPdf content originates from Claude's output and an
  // unescaped/unexpected reference is a real injection surface once a real
  // browser renders it, unlike pdf-lib's literal drawText calls.
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    // Only the in-memory page may load. Anything that would reach the network
    // or the disk (http, https, file, ftp...) is refused, even if some content
    // managed to ask for it. data: and about: stay allowed so setContent works.
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("about:")) {
        route.continue();
      } else {
        route.abort();
      }
    });
    await page.setContent(html, { waitUntil: "load" });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: CONTENT_MARGIN,
        bottom: showPageNumbers ? FOOTER_MARGIN : CONTENT_MARGIN,
        left: CONTENT_MARGIN,
        right: CONTENT_MARGIN,
      },
      displayHeaderFooter: showPageNumbers,
      headerTemplate: "<span></span>",
      footerTemplate: showPageNumbers
        ? `<div style="${FOOTER_STYLE}">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
        : "<span></span>",
    });
  } finally {
    await context.close();
  }
}
