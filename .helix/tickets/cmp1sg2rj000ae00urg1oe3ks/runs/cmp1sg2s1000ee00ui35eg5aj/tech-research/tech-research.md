# Tech Research: Helix CLI — Documentation Content Module

## Technology Foundation

helix-cli is a pure TypeScript CLI tool:

| Aspect | Value |
|--------|-------|
| Language | TypeScript 6.0 (strict mode) |
| Module system | ESM (`"type": "module"`) |
| Module resolution | Node16 |
| Build | `tsc` -> `dist/` |
| Declarations | Auto-generated (`declaration: true`) |
| npm publishing | `files: ["dist"]`, `publishConfig.access: "public"` |
| Runtime deps | None (only devDependencies) |

The package publishes only compiled JavaScript and declaration files from `dist/`. No exports map exists today. The `bin` field (`hlx: "dist/index.js"`) provides the CLI entry point.

## Architecture Decision

### Options Considered

**Option A: TypeScript module in `src/docs/` (CHOSEN)**

Create `src/docs/cli-content.ts` that exports structured documentation data. The existing `tsc` build compiles it to `dist/docs/cli-content.js` + `.d.ts`. An `exports` map entry in `package.json` at `"./docs"` makes it importable as `@projectxinnovation/helix-cli/docs`.

**Option B: Raw markdown file at repo root**

Place a `CLI_DOCS.md` file at the repo root and add it to the `files` array.

**Option C: JSON data file**

Place a `docs/cli-content.json` file and add the `docs/` directory to the `files` array.

### Chosen: Option A

**Rationale:**

1. **No build changes**: `src/docs/cli-content.ts` is automatically compiled by the existing `tsc` build. The output lands in `dist/docs/` which is already covered by the `files` array. No changes to `files`, `scripts`, or `tsconfig.json` needed.
2. **Type safety at source**: TypeScript validates the content shape at compile time in helix-cli itself. Typos, missing fields, or wrong types are caught before publish.
3. **Consumer type safety**: Auto-generated `.d.ts` declarations provide type checking when helix-global-client imports the content.
4. **Clean import path**: The `exports` map provides `@projectxinnovation/helix-cli/docs` — a clearly named, documented subpath.

### Why Others Were Rejected

| Option | Rejection Reason |
|--------|-----------------|
| B: Raw markdown | DocSection requires structured fields (id, title, order, keywords) alongside markdown. A raw .md file would require a parser to extract metadata — adds tooling complexity. |
| C: JSON file | No compile-time type checking at the source. Requires adding `docs/` to `files` array. JSON cannot include TypeScript-level documentation or type annotations. |

## Core API/Methods

### Export Shape

```typescript
// src/docs/cli-content.ts
export const cliDocsContent: {
  id: string;         // "helix-cli"
  title: string;      // "Helix CLI"
  content: string;    // Full markdown documentation string
  order: number;      // 2
  keywords: string[]; // CLI-relevant search terms
}
```

The `audience` field is omitted. It is a front-end concern — the consumer in helix-global-client assigns `audience: "developer"` when registering into the `DOC_SECTIONS` array.

### Package.json Exports

```json
{
  "exports": {
    "./docs": {
      "types": "./dist/docs/cli-content.d.ts",
      "import": "./dist/docs/cli-content.js"
    }
  }
}
```

- `"types"` first: TypeScript convention for condition ordering.
- `"import"` only: Package is `"type": "module"` (ESM). No CJS consumers.
- No `"."` entry: `bin` field works independently. Nothing imports the bare specifier.

## Technical Decisions

### 1. Pure Data Module (No Imports)

The content module must contain **zero imports**. It exports only:
- String literals (id, title, content)
- Number literals (order)
- String array literals (keywords)

**Why**: helix-global-client bundles this with Vite for the browser. Vite has no Node.js polyfill configuration. Any Node built-in reference (`fs`, `path`, `process`, etc.) would cause the consumer's build to fail.

**Enforcement**: Code review during implementation. The content is all static data — there is no technical reason for imports.

### 2. Content Scope

The markdown `content` field covers:
- Install: `npm install -g @projectxinnovation/helix-cli@latest`
- Setup/auth: `hlx login`, `hlx login --manual`, `hlx token add`
- Common commands: tickets, inspect, comments, update
- Worked examples for: `hlx tickets list` (with filters), `hlx tickets get` (with `--json`), `hlx tickets create` (with `--description-file`), `hlx tickets artifacts` (with `--run`), `hlx inspect repos`, `hlx comments post`
- Additional patterns: `hlx tickets update-description`, `hlx tickets continue --dry-run`
- Update: `hlx update`
- Troubleshooting: stale-link symptoms, clean-reinstall via npm, config location (`~/.hlx/config.json`)

All commands and flags verified against source code (see diagnosis/diagnosis-statement.md).

### 3. No Changes to Existing Files or Build

| Concern | Status |
|---------|--------|
| `files` array | No change — `dist/` already published |
| `tsconfig.json` | No change — `src/` is included, `dist/` is output |
| Build scripts | No change — `tsc` compiles all `.ts` in `src/` |
| `prepare` script | No change — `npm run build` (tsc) runs before publish |
| CLI source code | No change — ticket explicitly excludes CLI behavior changes |

The only `package.json` change is adding the `exports` field.

## Performance Expectations

| Metric | Impact |
|--------|--------|
| Build time | Negligible — one additional .ts file for tsc to compile |
| Package size | ~5-15KB increase in dist/ (single content file) |
| npm install time | No change — zero new dependencies |
| CLI runtime | No change — content module is never imported by CLI code |

## Dependencies

No new dependencies. The content module is pure data with zero imports. The existing `typescript` devDependency handles compilation.

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Node imports accidentally added to content module | Low | Consumer (helix-global-client) build fails | Pure data module pattern — no imports needed. Code review check. |
| 2 | Exports map syntax error | Low | Consumer cannot resolve import | TypeScript 6 validates exports resolution during helix-cli's own tests. Manual verification. |
| 3 | Content drifts from CLI source | Medium | Documentation inaccuracy | Content should be updated alongside CLI changes. Future: automated content generation (deferred). |

## Deferred to Round 2

- **Auto-generated reference docs**: Introspecting CLI source to generate documentation automatically. Ticket explicitly excludes this.
- **Content validation test**: A test that asserts the content module exists and has the correct shape. Useful but not required for MVP.
- **README.md**: The repo still has no README. This ticket addresses front-end docs, not repo-level documentation.

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Content location | `src/docs/cli-content.ts` | Compiles to dist/ automatically; covered by files array |
| Content format | TypeScript module | Type-safe at source and consumer; declarations auto-generated |
| Export shape | Single object (id, title, content, order, keywords) | Maps to DocSection minus audience |
| Exports map | `"./docs"` with types + import conditions | Compatible with bundler and Node16 resolution |
| Package.json changes | Add `exports` field only | No changes to files, scripts, or tsconfig |
| Browser safety | Zero imports in content module | Pure data — no Node APIs |

## APL Statement

helix-cli must create `src/docs/cli-content.ts` as a pure-data TypeScript module exporting documentation content (id, title, markdown content, order, keywords), and add a `package.json` exports map entry at `"./docs"` pointing to the compiled output. The existing `tsc` build and `dist/` publishing handle compilation and npm distribution with no changes. The content module must contain no imports to ensure browser compatibility when consumed by helix-global-client's Vite build.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-global-client) | Primary requirements and acceptance criteria | Canonical content in helix-cli; build-fail-on-missing required; documented commands must match published CLI |
| `scout/reference-map.json` (helix-cli) | Package structure and command inventory | Only dist/ published; no exports map; all ticket-required flags verified |
| `scout/scout-summary.md` (helix-cli) | Publishing config and command structure | Public npm; files: [dist]; 7 command groups with verified flags |
| `diagnosis/apl.json` (helix-cli) | Content structure and exports decisions | src/docs/cli-content.ts; exports map at ./docs; verified command inventory |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and CLI-side approach | Create content module; add exports map; pure data module requirement |
| `product/product.md` (helix-global-client) | Product specification and content requirements | Required content sections; build-fail guarantee; version strategy deferred to tech-research |
| `repo-guidance.json` | Shared repo intent | helix-cli is a target repo — content source and exports map |
| `package.json` (helix-cli) | Direct inspection | type: module; files: [dist]; no exports; no runtime dependencies |
| `tsconfig.json` (helix-cli) | Build config | declaration: true; module: Node16; outDir: dist; rootDir: src |
| TypeScript docs (Context7, v5.9.3) | Exports map resolution verification | Conditional exports with types+import supported in Node16 resolution |
