# Contributing

Thanks for helping make these files look better. The two easiest ways in are a **theme** and a **layout**.

## Add a theme (no code)

1. Add `themes/<name>.json`. Copy an existing one. The name is lowercase letters, digits and dashes.
2. Colors are six hex digits, no `#`. Do not add text colors; the engine derives them.
3. Run `npm test`. A test checks every theme is valid and uniquely named.
4. Optional: `node dist/cli.js build examples/deck.json -o /tmp/deck.pptx --theme <name>` and look at it in PowerPoint or LibreOffice.

Starting from a PowerPoint file you have the rights to use? `node dist/cli.js import-theme file.pptx -o themes/<name>.json` gives you a first draft. Check the colors before you commit.

## Add a slide layout

A layout is one file in `src/layouts/` that says what JSON it takes, how to draw it, and gives one example.

1. Copy `src/layouts/pricing.ts` to `src/layouts/<your_layout>.ts`.
2. Fill in `name`, `description`, `normalize`, `render` and `example`.
3. Import it in `src/layouts/index.ts` and add it to `COMMUNITY_LAYOUTS`.
4. Run `npm test`. Every community layout's `example` is normalized and drawn by a test, so a layout without a working example fails.
5. Run `node dist/cli.js preview <your_layout> -o /tmp/preview.pptx` and open it. Include a screenshot in your pull request.

Rules for layouts:

- **`normalize` never throws and never trusts input.** Check types, trim strings, cap lengths and counts, and return `null` if the slide cannot be drawn. Anything it returns is what `render` gets.
- **`render` is synchronous and draws only.** No file reads, no network, no `require`/`import()` at run time, no global state.
- **Use the palette.** Take colors and fonts from `ctx.colors`. Every text color there is already readable on the background, including for dark themes. Do not hard-code hex colors for text.
- **Clean every string** with `helpers.clean(text)` before you draw it.
- **Start with `helpers.chrome(title)`** unless you are deliberately drawing your own header. Stay between `helpers.contentTop` and `helpers.contentBottom`.
- **Names** are lowercase letters, digits and underscores, and cannot reuse a built-in name.
- Keep text inside its box. Cap list lengths so the longest allowed input still fits.

## Change an existing layout, PDF, Word or Excel output

Open an issue first if the change alters how existing files look, so we can agree on it. Add or update a test next to the code you change.

## Pull requests

- One idea per pull request.
- `npm test` and `npm run typecheck` pass.
- Do not add a dependency without saying why in the description.
- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).
