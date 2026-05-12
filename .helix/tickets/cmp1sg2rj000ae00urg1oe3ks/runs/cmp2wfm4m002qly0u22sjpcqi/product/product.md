# Product Specification: Helix CLI First-Party Documentation

## Problem Statement

The Helix CLI (`@projectxinnovation/helix-cli`, binary `hlx`) has zero first-party documentation. The only command reference is a `usage()` string in source code (`src/index.ts` lines 35-55). Users today rely on reading CLI source files, an operational-history file (`HELIX_CLI_NOTES.md`, no longer present in the repo), or word-of-mouth for install steps, auth setup, command syntax, and troubleshooting. New users and agents have no canonical landing place that tells them how to install, authenticate, and use the CLI.

## Product Vision

Provide a single, discoverable documentation page within the existing Helix web app (`helix-global-client`) that covers CLI install, setup, and everyday use. The content is owned by the `helix-cli` repo so it stays in sync with the tool it describes, while the front-end renders it alongside existing docs.

## Users

| User | Need |
|------|------|
| **New Helix users** | Step-by-step install, auth, and first-command guidance without reading source code |
| **Existing Helix users** | Quick-reference for less-used commands, flags, and worked examples |
| **Automated agents** | Programmatic access to canonical CLI syntax (e.g., via `--json` flag patterns) |

## Use Cases

1. **First-time install**: A user visits the docs page, copies the npm install command, and installs `hlx`.
2. **Auth setup**: A user follows login instructions (OAuth or manual token) to authenticate.
3. **Day-to-day command lookup**: A user searches for or browses commands grouped by area (tickets, inspect, comments, update) and sees worked examples.
4. **Troubleshooting**: A user experiencing stale-link or version-mismatch issues finds clean-reinstall recovery steps.
5. **Discoverability**: A user clicks through existing navigation in the Helix web app and finds the CLI docs without knowing a direct URL.

## Core Workflow

```
User opens Helix web app
  → clicks "Docs" in top nav (already exists)
  → lands on docs landing page
  → navigates to "Developer Docs" category
  → opens "Helix CLI" section
  → reads install, setup, commands, examples, and troubleshooting content
```

## Essential Features (MVP)

1. **Documentation page in helix-global-client** rendered under the existing docs system at `/docs/developer/helix-cli` (or equivalent slug).
2. **Content sections** covering:
   - Install via `npm install -g @projectxinnovation/helix-cli@latest`
   - Initial setup and authentication (`hlx login`, `hlx login --manual`, `hlx token add`)
   - Common commands grouped by area: tickets, inspect, comments, update
   - Worked examples for: `hlx tickets list` (with filters), `hlx tickets get` (with `--json`), `hlx tickets create` (with `--description-file`), `hlx tickets artifacts` (with `--run`), `hlx inspect repos`, `hlx comments post`
   - Additional high-value patterns: `hlx tickets update-description`, `hlx tickets continue --dry-run`
   - Update instructions via `hlx update`
   - Troubleshooting: stale-link symptoms, clean-reinstall via npm
3. **Canonical content source in helix-cli** — a clearly named file or directory that the front-end consumes (not a hand-maintained copy in helix-global-client).
4. **Navigation entry point** — reachable from the existing "Docs" top-nav link without prior URL knowledge.
5. **Build-fail guarantee** — if the canonical content source is removed from helix-cli, the helix-global-client build fails with a clear error naming the missing source. The front-end must not ship a blank or stub page.
6. **Landing page count update** — the developer docs category card reflects the new section count.

## Features Explicitly Out of Scope (MVP)

- Complete man-page reference for every flag of every subcommand.
- Auto-generated reference documentation from CLI source code.
- Internationalization of the docs page.
- Changes to CLI behavior or source code.
- GitHub-tarball install path or legacy `npm link` recovery as primary instructions.
- A new top-level route in helix-global-client (the existing `/docs` route and infrastructure are sufficient).
- Multiple doc pages/sections for the CLI (one section is sufficient per existing pattern).

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Doc page reachable from navigation without manual URL entry | Navigate from "Docs" link → Developer Docs → Helix CLI section |
| 2 | Content sourced from a single canonical location in helix-cli | Import traces to a clearly named file in helix-cli, not inline content in helix-global-client |
| 3 | Install section shows `npm install -g @projectxinnovation/helix-cli@latest` | Page content inspection |
| 4 | Update section shows `hlx update` | Page content inspection |
| 5 | At least one worked example each for: `hlx tickets list`, `hlx tickets get`, `hlx tickets create`, `hlx tickets artifacts`, `hlx inspect repos`, `hlx comments post` | Page content inspection |
| 6 | Removing the canonical content file causes helix-global-client build to fail with a clear error naming the missing source | Delete content file, run `tsc -b && vite build`, observe error |
| 7 | Build passes: `npm run typecheck && npm run lint` in helix-global-client | CI or local build |

## Key Design Principles

- **Single source of truth**: Documentation content lives in helix-cli only. The front-end consumes it, never duplicates it.
- **Minimal infrastructure change**: The existing docs system (routing, sidebar, search, markdown rendering) already handles new sections dynamically. No structural changes needed.
- **Accuracy over completeness**: Document only published commands and flags. Do not document unreleased features.
- **Build-time safety**: Missing content must be a build-breaking error, not a runtime blank page.

## Scope & Constraints

- **Two-repo coordination**: Changes span helix-cli (content source + package exports) and helix-global-client (dependency + registration + landing page count).
- **Existing doc pattern**: All 14 current doc sections are inline TypeScript objects in `src/lib/docs-content.ts` with `DocSection` shape (`id`, `title`, `audience`, `content`, `order`, `keywords`). The CLI content must integrate into this pattern.
- **Audience placement**: The `developer` audience category is the correct fit (currently 1 section: NetSuite Integration). CLI tooling is developer-facing technical content.
- **Hard-coded counts**: `docs-landing.tsx` has hard-coded section count strings ("7 sections", "1 section", "6 sections") that are not dynamically computed. The developer count must be manually updated.
- **npm package is public**: `@projectxinnovation/helix-cli` has `publishConfig.access: "public"`, so it can be added as a dependency.
- **No exports map today**: helix-cli `package.json` has no `exports` field; one must be added.
- **Package name and binary name are fixed**: `@projectxinnovation/helix-cli` and `hlx` respectively. Documentation must use these exactly.

## Future Considerations

- Dynamically computing section counts in `docs-landing.tsx` instead of maintaining hard-coded strings.
- Auto-generating partial CLI reference docs from source code (introspecting commands/flags).
- Expanding the docs page as new CLI commands are added.
- Versioned documentation if CLI major versions diverge significantly.

## Open Questions / Risks

| # | Question / Risk | Impact | Status |
|---|----------------|--------|--------|
| 1 | Cross-repo dependency version management: should helix-global-client pin a specific version of `@projectxinnovation/helix-cli` or use a range? | Affects whether content updates require a dependency bump in helix-global-client. | Technical decision — deferred to tech-research/implementation. |
| 2 | The content module must be a pure data module (no `fs`, `path`, or Node-specific imports) to be bundleable by Vite for the browser. | If Node imports leak in, the Vite build breaks. | Risk — must be enforced in implementation. |
| 3 | No runtime inspection manifest available — cannot verify current production docs behavior. | Product decisions are based on static code analysis only. | Low risk — docs system behavior is well-understood from source. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-global-client) | Primary problem statement, decisions, invariants, acceptance criteria | Two-repo feature: canonical content in helix-cli, rendered page in helix-global-client, build-fail-on-missing required |
| `scout/scout-summary.md` (helix-global-client) | Docs system architecture and content flow | All content inline in `docs-content.ts`; 14 sections across 3 audiences; hard-coded landing page counts; no cross-repo pattern |
| `scout/scout-summary.md` (helix-cli) | CLI command inventory and publishing config | Zero docs artifacts; `dist/` published; no exports map; 7 command groups; auth via OAuth + manual |
| `scout/reference-map.json` (helix-global-client) | File-level detail on docs infrastructure | DocSection type shape; DOC_SECTIONS is single data source; dynamic section resolution by slug+audience |
| `scout/reference-map.json` (helix-cli) | Package structure and command flags | All ticket-required commands/flags verified against source; config at `~/.hlx/config.json` |
| `diagnosis/diagnosis-statement.md` (helix-global-client) | Root cause analysis and recommended approach | npm dependency with typed content export; `developer` audience; single DocSection; build-fail guarantee via TypeScript strict import resolution |
| `diagnosis/diagnosis-statement.md` (helix-cli) | CLI-side diagnosis and verified command inventory | Create `src/docs/cli-content.ts`; add `exports` map; all commands/flags verified against source |
| `diagnosis/apl.json` (helix-global-client) | Detailed Q&A on approach decisions | Content module format, consumption mechanism, audience placement, file change set, build failure mechanism, section count |
| `diagnosis/apl.json` (helix-cli) | CLI-side Q&A on content structure and exports | Content structure, package.json changes, full command/flag inventory |
| `repo-guidance.json` (helix-global-client) | Repo intent and change scope | Both repos are targets; helix-global-client needs dependency + registration; helix-cli needs content module + exports |
