# Structural Copilot MVP Architecture

## Goals

- Constrain the product to approved structural engineering workflows.
- Keep model reasoning private behind a backend orchestrator.
- Support mocked tools first, then replace with real internal structural apps.
- Make it straightforward to add roughly 30 tools without rewriting the app.

## Stack

- Frontend and API shell: Next.js App Router with TypeScript
- Validation: Zod
- Testing: Vitest
- Backend execution model for MVP: server-side TypeScript modules called by route handlers

## Layering

### `src/app`

- User-facing pages and API routes only
- No engineering logic embedded directly in React components
- No direct access to internal tool URLs or model worker details

### `src/server/domain`

- Request validation
- Domain guard for in-scope structural prompts
- Workflow eligibility checks
- Future hooks for auth, rate limits, token budgets, and audit logging

### `src/server/orchestrator`

- Deterministic workflow engine
- Approved workflow registry
- Sequential tool invocation and ranking logic
- Private reasoning only where interpretation or explanation is helpful

### `src/server/tools`

- Internal interfaces for structural tool adapters
- Mock implementations for MVP development
- Real tool integrations can replace these adapters later without changing UI contracts

### `src/server/reasoning`

- Private service abstraction for model-assisted interpretation and summaries
- Never called directly by the frontend
- Only reachable through approved workflows

### `src/types`

- Shared contracts for UI, API, and server modules

## Planned MVP Workflow

1. Validate payload shape and units.
2. Reject prompts outside structural engineering scope.
3. Route to the approved RC beam workflow.
4. Extract and normalize inputs from prompt plus structured fields.
5. Call `designActions`.
6. Iterate candidate RC sections and reinforcement combinations in code.
7. Check moment and shear capacity using tool adapters.
8. Rank feasible solutions and request a steel alternative.
9. Return structured results for rendering and charts.

## Security Notes

- The frontend receives only structured outputs.
- Raw tool endpoints remain private inside adapter implementations.
- The orchestrator owns workflow restrictions and allowed capability lists.
- The reasoning layer must not have arbitrary web access or unrestricted tool access.
