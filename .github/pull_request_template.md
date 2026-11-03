## What this changes

<!-- One idea per pull request. Link the issue if there is one. -->

## Checklist

- [ ] `npm test` and `npm run typecheck` pass
- [ ] New or changed behavior has a test
- [ ] No new dependency (or I explained why below)

### Theme (if you added one)
- [ ] `themes/<name>.json` with a lowercase dashed name and six-digit hex colors, no text colors

### Layout (if you added one)
- [ ] `normalize` never throws, caps lengths and counts, and returns `null` for unusable input
- [ ] `render` is synchronous, uses `ctx.colors` and `helpers.clean`, and stays inside the content area
- [ ] Registered in `src/layouts/index.ts`, with a working `example`
- [ ] Screenshot from `node dist/cli.js preview <layout> -o preview.pptx` attached

### Editor (if you changed `src/edit/`, `src/editor/` or `src/prompts/`)
- [ ] Editing logic stays pure (no Node, no `fetch`), and an edit returns a new deck
- [ ] Nothing in a component reaches a server: it goes through `DeckEditorHost` (new methods are optional, or the breaking change is explained below)
- [ ] No wording that belongs to one program: it is a `labels` entry with a default
- [ ] Colours only from the `--ds-*` variables; checked at phone width
- [ ] Screenshot attached (light and dark if colours changed)
- [ ] Prompt change: example reply before and after attached, fence names unchanged

