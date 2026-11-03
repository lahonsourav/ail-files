# Contributing

Thanks for helping make these files look better. The easiest ways in are a **theme**, a **layout**, and the **editor** that people use to change a deck after it is made.

Running the tests needs Node 22.12 or newer (the test runner requires it). Using the package only needs Node 20.

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

## Improve the editor

The deck editor (the slide strip, the live preview, the fields, the pickers, drag handles, undo, the "ask about this slide" box) lives here, in two parts, so you never need the Ail app to change it.

| What you want to change | Where it is |
| --- | --- |
| What an edit does to a deck: add, move, copy and delete slides, set a field, move and resize parts, undo history, which control a field gets | `src/edit/deckEdit.ts` |
| Two people editing one deck (the three-way merge) | `src/edit/deckMerge.ts` |
| Turning a normal slide into a free-form one | `src/edit/slideToFreeForm.ts` |
| A slide's own look (picture, colours, font, text size, placed pictures) | `src/edit/slideOptionsEdit.ts` |
| What the model is told when someone asks about one slide, and how its reply is read | `src/edit/slideAsk.ts` |
| What the model is told to make a deck, PDF, Word or Excel file from a chat | `src/prompts/index.ts` |
| The screen: layout, the form for each kind of field, the toolbar, the pickers, the handles on the slide | `src/editor/*.tsx` (`DeckEditor.tsx` is the page; `SlideForm.tsx` walks a slide's fields, so a new layout needs no form code) |
| What the editor needs from the program around it | `src/editor/host.ts` (`DeckEditorHost`); `playground/` is a complete example of one |

Rules:

- **Editing logic is pure.** Everything in `src/edit/` and `src/prompts/` runs in a browser, in Node and in a test, so it may not import Node, `sharp`, `pptxgenjs` or the PDF printer (`test/browser.test.ts` fails if it does). An edit takes a deck and returns a new deck; it never changes the one it was given.
- **The editor never reaches for a server, a store or an account.** Saving, drawing the preview, asking the model, downloading and listing versions all go through the `host` the program passes in. If the editor needs something new from the program, add a method to `DeckEditorHost`, make it optional where you can, and say in the pull request what a program has to do to support it. Do not call `fetch` from a component.
- **No wording that belongs to one program.** Anything an app would say differently (its assistant's name, where pictures are kept) is a `labels` entry with a plain default, not a string in a component.
- **Style with the ten `--ds-*` colours only** (`styles/editor-tokens.css` lists them) and Tailwind classes, so the editor takes on the look of whatever program it is in. No hard-coded colours, no other CSS files.
- **Motion follows six behaviours** (numbers in `src/editor/motion.ts`): a button sinks to 95% and springs back (`PressEffect`, mounted once by the program), the slide being dragged in the strip lifts to 105% while the others slide out of the way (`useFlip`), what opens eases out in 350 ms (fast first, then slow), a success tick draws its circle and then the tick in 470 ms (`SuccessTick`). Use those, not a new transition, and keep every one off under `prefers-reduced-motion`.
- **Keep it working on a phone.** The three parts stack and dragging is left out below the large breakpoint; check your change at phone width too.
- **A control needs a label a screen reader can read**, and a button that does something destructive says what it does ("Remove", not only a cross).

Try your change:

1. `npm test` runs the editing tests and `test/editor.test.ts`, which renders the whole editor from a stand-in host. Add a test for new behaviour next to it: for an edit, in the test file named after the module; for a control, a render test that checks what it shows.
2. To see it on screen, run `npm install` and then `npm run editor`, and open http://localhost:5173. That is the real editor on a page, with a small backend behind it (`playground/api.ts`) that draws the slides with the engine, saves in memory, makes the .pptx when you press Download, and turns a slide free-form. It reloads when you change the editor, the editing code or the engine, so you see your change straight away. Open it in two tabs to try live sync. To try the "ask about this slide" box, start it with `ANTHROPIC_API_KEY=... npm run editor` (`PLAYGROUND_MODEL` picks the model). Needs Node 22.12 or newer. `playground/main.tsx` is also the shortest example of what a program does to use the editor.
3. Put a screenshot of the change in the pull request, light and dark if colours are involved, and one at phone width if the layout moved.

Changing the model prompts (`src/prompts/`, `src/edit/slideAsk.ts`) changes what every program built on this package tells its model. Open an issue first, show an example of a reply before and after, and keep the fenced block names (` ```slides `, ` ```pdf_doc `, ` ```docx_doc `, ` ```excel_doc `) exactly as they are: programs read replies by them.

## Where the engine is changed

This repository is the only home of the engine. The [Ail app](https://www.ailighthouse.in), the main user of this package, does not keep a copy: it installs a tagged release of `ail-files`, so a fix or feature made here reaches its users when a maintainer tags a release and the app moves to it. You never need access to the Ail app to work on this repository: JSON goes in and a file comes out, and the tests, the CLI and the examples here cover all of it.

Four entry points are published. `ail-files` is the full engine and needs Node. `ail-files/edit` is the editing logic and the prompts (pure code, same rule as `browser`). `ail-files/editor` is the React editor, driven by a `DeckEditorHost` (see the README); it must not import the Ail app or call a server directly, so keep every `fetch`, store and account behind the host. `ail-files/browser` holds only pure code (cleaning up JSON, the picture and logo rules, the examples and every type) so it can be bundled into a web page: keep anything that needs Node, `sharp`, `pptxgenjs` or the PDF printer out of `src/browser.ts` and the files it imports. `test/browser.test.ts` fails if you don't.

## Change an existing layout, PDF, Word or Excel output

Open an issue first if the change alters how existing files look, so we can agree on it. Add or update a test next to the code you change.

## Pull requests

- One idea per pull request.
- `npm test` and `npm run typecheck` pass.
- Do not add a dependency without saying why in the description.
- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Releases (maintainers)

Other projects install a release tag straight from GitHub, so a release is what ships.

1. In a pull request, set `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`) and merge it once CI is green.
2. On GitHub, publish a release whose tag matches, for example `v0.1.2`, targeting `main`.
3. Projects that depend on a tag move to the new one on their own schedule. Nothing follows `main`.
