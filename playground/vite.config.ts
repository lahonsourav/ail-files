import { defineConfig, type ViteDevServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDocStore, createStore, handle, type DocStore, type Modules } from "./api.js";

// `npm run editor` starts this: the real editor (src/editor) on a page, with a small in-memory backend (api.ts) behind it, so a change
// to the editor, the editing code or the engine can be seen on screen without any other program. Changes reload by themselves.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (file: string) => path.resolve(here, "../src", file);

async function modules(server: ViteDevServer): Promise<Modules> {
  // Loaded again on every request: Vite keeps them until a file changes, so an edit to the engine shows on the next preview.
  const [engine, edit, browser] = await Promise.all([server.ssrLoadModule(src("index.ts")), server.ssrLoadModule(src("edit.ts")), server.ssrLoadModule(src("browser.ts"))]);
  return { engine, edit, browser } as unknown as Modules;
}

export default defineConfig({
  root: here,
  clearScreen: false,
  server: { port: 5173, fs: { allow: [path.resolve(here, "..")] } },
  plugins: [
    tailwindcss(),
    {
      name: "ail-files-playground-api",
      configureServer(server) {
        let store: ReturnType<typeof createStore> | undefined;
        let docs: Record<"pdf" | "docx", DocStore> | undefined;
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          const m = await modules(server);
          store ??= createStore(m.browser.normalizeDeck(m.browser.EXAMPLE_DECK, { editing: true }));
          docs ??= {
            pdf: createDocStore(m.edit.normalizeDoc(m.browser.EXAMPLE_PDF, "pdf")),
            docx: createDocStore(m.edit.normalizeDoc(m.browser.EXAMPLE_DOCX, "docx")),
          };
          if (!(await handle(req, res, m, store, docs))) next();
        });
      },
    },
  ],
});
