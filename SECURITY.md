# Security

ail-files turns data from people and from AI models into files, and one output (PDF) goes through a real browser. It is treated that way.

## What is protected

- **PDF rendering.** JavaScript is off, and every network or file request from the page is refused. Document text is escaped before it becomes HTML. `test/pdfSecurity.test.ts` proves it against a local server.
- **Theme import.** Only the color scheme and font names are read from a `.pptx`. Input size, entry count and XML size are capped. The XML is read with patterns, not an XML parser, so there are no external entities to resolve.
- **Layouts.** A layout's `normalize` and `render` run inside try/catch. A broken layout costs its own slide, not the file.
- **Input.** Every `normalize…` function accepts anything and returns clean data or `null`.

## What is not

- A community layout is code that runs in your process when a deck uses it. Only install layouts you have read. Review layout pull requests like any other code.
- Chromium is started with `--no-sandbox` so it works in containers. If you run this on untrusted input, run it in a container or VM.

## Reporting a problem

Please report security problems privately, using GitHub's "Report a vulnerability" on the repository's Security tab, not a public issue. Include what you did and what happened. We will reply within a few days.
