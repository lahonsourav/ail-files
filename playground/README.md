# Editor playground

`npm run editor` (from the repository root) opens the real deck editor on http://localhost:5173, so a change to it can be seen on screen.

- `main.tsx` is the page: it gives `DeckEditor` a deck, three sample pictures and a `host` whose methods call the routes below. It is the smallest complete example of using the editor in a program.
- `api.ts` is the backend, in memory: `GET/PUT /api/deck` (save with a version check; a stale save gets the current deck back, which is what makes two tabs merge), `/api/snapshots` (versions), `POST /api/preview` (draws the deck with `recordDeck`), `/api/free-form`, `/api/export` (builds the .pptx), `/api/ask` (calls the model when `ANTHROPIC_API_KEY` is set).
- `vite.config.ts` runs it all with Vite and the Tailwind plugin, and loads the engine from `src/` again whenever a file changes.

Nothing here is published with the package. `test/playground.test.ts` tests the backend, and CI builds the page so it cannot break unnoticed.

## The document editor

Open `/?doc=pdf` or `/?doc=docx` for the Word and PDF editor. Its routes are in `api.ts` under `/api/doc` (`GET/PUT /api/doc`, `/api/doc/snapshots`, `POST /api/doc/preview` (the PDF maker's HTML, each section tagged), `/api/doc/ask` and `/api/doc/ask-document` (the model, when `ANTHROPIC_API_KEY` is set), `/api/doc/export`), one document per file type. The playground has no pictures or logo.
