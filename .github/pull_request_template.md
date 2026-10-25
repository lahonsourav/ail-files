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
