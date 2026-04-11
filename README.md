# Structural Copilot MVP

This repository contains a production-oriented MVP scaffold for a constrained structural engineering copilot. It is intentionally not a general chatbot. The system is being built around guarded workflows, private orchestration, typed tool adapters, and structured engineering outputs.

## Current Phase

Phases 1 to 3 are implemented:

- Next.js + TypeScript app scaffold
- constrained landing page and product framing
- guarded backend service with domain rejection and approved workflow routing
- RC beam design workflow with real browser-backed `designActions`, moment, and shear integrations
- timber member design workflow with a real browser-backed timber capacity integration
- section property workflow with a real browser-backed advanced section property integration
- interactive prompt-only frontend workbench connected to `/api/copilot`
- structured engineering result rendering and chart-ready visualisation output
- architecture documentation and passing lint, test, and build checks

## Planned MVP Capabilities

- reject non-structural prompts before expensive execution
- route approved prompts into deterministic engineering workflows
- call mocked structural tool adapters first, then swap in real integrations
- render summary, assumptions, outputs, recommendations, alternatives, and visuals

## Scripts

```bash
pnpm dev
pnpm lint
pnpm test
```

## GitHub And Netlify

This repo is ready to be committed to GitHub and deployed from Netlify.

### Recommended repository name

`hazzi39/structural-copilot-mvp`

### Netlify deployment

Netlify currently supports deploying modern Next.js projects directly from a Git repository and can auto-detect the framework and build settings. For this repo, the explicit project settings are:

- Build command: `pnpm build`
- Publish directory: `.next`
- Node version: `20`

Those settings are also captured in [netlify.toml](/c:/Coding/OpenClawDummy/netlify.toml).

### Environment variables

Add the same values from your local `.env.local` into Netlify project environment variables before your first production deploy, especially:

- `STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL`
- `STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL`
- `STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL`
- `STRUCTURAL_RC_MOMENT_TOOL_URL`
- `STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL`
- `STRUCTURAL_RC_SHEAR_TOOL_URL`
- `STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL`
- `STRUCTURAL_TIMBER_TOOL_URL`
- `STRUCTURAL_ENABLE_ADVANCED_SECTION_PROPERTY_BROWSER_TOOL`
- `STRUCTURAL_ADVANCED_SECTION_PROPERTY_TOOL_URL`

If you later use the HTTP tool path instead of browser-only tools, also add:

- `STRUCTURAL_DESIGN_ACTIONS_URL`
- `STRUCTURAL_TOOL_API_KEY`

### Deploy from GitHub

1. Create a GitHub repository.
2. Push this project to the default branch.
3. In Netlify, choose `Add new project` -> `Import an existing project`.
4. Select GitHub and authorize the repository.
5. Confirm the build settings and publish.

## Real Tool Integration

Tool configuration is now centralized in the backend registry at [src/server/tools/tool-registry.ts](/c:/Coding/OpenClawDummy/src/server/tools/tool-registry.ts). This registry defines the approved tool origins, workflow associations, and env toggles for each integration.

The `designActions` adapter can now call a real structural tool over HTTP from the server side.

1. Copy `.env.example` to `.env.local`
2. Set `STRUCTURAL_DESIGN_ACTIONS_URL`
3. Optionally set `STRUCTURAL_TOOL_API_KEY`
4. Start the app with `pnpm dev`

When `STRUCTURAL_DESIGN_ACTIONS_URL` is not configured, the app falls back to the local mock adapter so development still works.

The preferred path for your current stack is the browser-only design actions tool.

1. Set `STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL=true`
2. Optionally override `STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL`
3. Install Chromium once with `pnpm exec playwright install chromium`

When enabled, the backend drives `designactionspremium.netlify.app` privately with Playwright and normalizes `Vmax` and the governing moment back into the workflow.

The `rcMomentCapacity` adapter can also run the live browser-only tool with Playwright.

1. Set `STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL=true`
2. Optionally override `STRUCTURAL_RC_MOMENT_TOOL_URL`
3. Install Chromium once with `pnpm exec playwright install chromium`

When the browser tool flag is not enabled, RC moment capacity falls back to the internal mock calculation.

The `rcShearCapacity` adapter can also run the live browser-only shear tool.

1. Set `STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL=true`
2. Optionally override `STRUCTURAL_RC_SHEAR_TOOL_URL`
3. Install Chromium once with `pnpm exec playwright install chromium`

When enabled, the backend drives `concreteshearstrength.netlify.app` privately and normalizes `φVu` back into the workflow.

The timber member workflow is also enabled through the registry-backed browser tool.

1. Set `STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL=true`
2. Optionally override `STRUCTURAL_TIMBER_TOOL_URL`
3. Install Chromium once with `pnpm exec playwright install chromium`

When enabled, the backend drives `timbercapacityprem.netlify.app` privately and returns timber capacity outputs through the same structured response contract.

The section property workflow is also enabled through the registry-backed browser tool.

1. Set `STRUCTURAL_ENABLE_ADVANCED_SECTION_PROPERTY_BROWSER_TOOL=true`
2. Optionally override `STRUCTURAL_ADVANCED_SECTION_PROPERTY_TOOL_URL`
3. Install Chromium once with `pnpm exec playwright install chromium`

When enabled, the backend drives `advancedsectionproperty.netlify.app` privately and returns normalized area, centroid, and inertia properties for approved shapes.

## Architecture

See [docs/architecture.md](/c:/Coding/OpenClawDummy/docs/architecture.md) for the layer boundaries and planned workflow behavior.
