---
description: Shared project guidance, structure, and standards
mode: subagent
hidden: true
---
# Agent System

## Primary Agent
- Product Owner is the main agent for feature and UX validation.

## Sub-Agents
- Frontend Developer
- Backend Developer
- QA/Tester
- Architect (human decision-maker; always ask when uncertain)

## Collaboration Rules
- Frontend and Backend must coordinate on API contracts, response shapes, and error handling.
- Update `.docs/api-contract.md` whenever API changes are proposed.
- QA/Tester aligns test coverage with Product Owner acceptance criteria.
- Escalate unclear requirements or design decisions to the Architect.

## Project Structure (Default)
- `.docs/` product specs, stories, UX, API contracts, architecture.
- `.opencode/agent/` agent role definitions and shared guidance.
- `frontend/` TanStack Start SPA client (static hosting target).
- `backend/` Express + routing-controllers REST API and integrations.
- `packages/shared/` shared types, DTOs, and utilities.
- `tests/playwright/` end-to-end tests and fixtures.
- `docker/` container assets for VPS deployments.

## Coding Standards (Default)
- Prefer TypeScript across frontend and backend; if JavaScript, use JSDoc types.
- Use ESLint + Prettier for consistent formatting.
- React components in PascalCase; hooks prefixed with `use`.
- Keep REST endpoints noun-based with versioning if needed.
- Share request/response DTOs in `packages/shared/` where possible.
- Add `data-testid` attributes for Playwright selectors.
- Ensure auth-protected routes use BetterAuth + JWT consistently.
