# Phase 1 Fullstack SOW

## Objective
- Deliver MVP Phase 1 foundation for auth, core inbox, and IRC messaging across backend and frontend.
- Establish shared types/schemas and project structure to enable Phase 2 real-time features and Telegram integration.

## Scope of Work

### Backend
- Set up core Express API structure and routing conventions for Phase 1 endpoints.
- Implement authentication flows (login, logout, forgot/reset password) with BetterAuth.
- Define RBAC middleware for four roles and protect Phase 1 endpoints.
- Create baseline inbox endpoints for conversations list and filters.
- Implement IRC connector with socket connection to networks/channels.
- Implement IRC message ingestion (inbound to conversations).
- Implement IRC message endpoint for outbound replies.
- Implement WebSocket gateway for real-time message updates.
- Configure message retry queue (Redis + BullMQ) with exponential backoff.
- Establish database schema migrations for Phase 1 entities in PostgreSQL with Drizzle.
- Add audit logging hooks for auth and inbox access actions.
- Configure environment variables and config validation for Phase 1 services.

### Frontend
- Implement login, forgot password, and reset password screens.
- Build inbox list view with filters and pagination.
- Add conversation detail view with IRC message timeline.
- Implement message composer for IRC outbound replies.
- Wire WebSocket client for real-time message updates.
- Wire API client to auth and inbox endpoints with error handling.
- Add basic layout, navigation, and protected route handling.
- Implement role-based UI gating for Phase 1 screens.
- Display message status (pending/sent/failed) with retry button.

### Shared
- Define shared types/schemas for auth, users, roles, conversations, and messages.
- Add API response/request contracts for Phase 1 endpoints.
- Set up common validation utilities for shared DTOs.

## Out of Scope
- Real-time presence and typing indicators (Phase 2).
- Telegram integration (Phase 2).
- Tags, notes, assignments, routing rules, notifications (Phase 3).
- Attachment handling (Phase 2).
- Search (PostgreSQL FTS) (Phase 2).
- Admin panel features (Phase 3).
- Audit log UI (Phase 3).
- Message export features (Phase 4).

## Deliverables
- Backend Phase 1 API with auth, RBAC, inbox endpoints, IRC connector, WebSocket gateway, and DB schema.
- Frontend Phase 1 UI with auth flows, inbox list, conversation detail, IRC message composer, and real-time updates.
- Message retry queue configured with exponential backoff (1m, 5m, 30m) and DLQ.
- Shared types and validation utilities for Phase 1.
- Environment/config templates and setup notes for Phase 1.
- Postman collection or API examples for Phase 1 endpoints.

## Acceptance Criteria
- Users can log in, log out, and complete password reset flow.
- RBAC enforces access to inbox endpoints and protected UI routes.
- Inbox list endpoint supports filters and pagination per spec.
- Frontend inbox list displays data from API with error states.
- IRC connector connects to networks/channels and auto-reconnects on disconnect.
- IRC inbound messages appear in conversation timeline in real-time.
- Users can send IRC replies via message composer with status tracking (pending/sent/failed).
- Failed messages trigger retry with exponential backoff; final failures go to DLQ.
- Database schema matches Phase 1 entities and passes migrations.
- WebSocket gateway pushes message.received, message.sent, message.failed events.

## Timeline
- Week 1: Auth, RBAC, schema, basic API scaffolding, IRC connector setup.
- Week 2: Inbox endpoints, IRC messaging endpoints, WebSocket gateway, frontend inbox UI, frontend message composer.
- Week 3: Message retry queue, integration testing, QA handoff preparation.

## Assumptions
- Single-tenant MVP with credentials in environment variables.
- PostgreSQL, Redis, and core infrastructure are available.
- BetterAuth is approved for auth flows.
- IRC networks and channels are known and configured.
- Product specifications in `.docs/` are source of truth.

## Dependencies
- Access to PostgreSQL instance and credentials.
- Email provider configuration for password reset.
- Finalized API contract from `.docs/02-api-and-data-model.md`.
- Design direction for inbox and conversation detail UI.
- IRC network credentials and test channels.

## Roles & Responsibilities
- Product Owner: validate scope, ACs, and UX flow.
- Architect: confirm technical decisions and unblock ambiguities.
- Backend Developer: implement API, schema, RBAC, audit hooks, IRC connector, WebSocket gateway, message retry queue.
- Frontend Developer: implement auth flows, inbox UI, conversation detail, message composer, WebSocket client.
- QA: validate Phase 1 acceptance criteria and regression checks.

## Change Control
- Scope changes require written approval from Product Owner and Architect.
- New requirements are logged with impact on timeline and deliverables.
- Phase 1 scope additions may shift milestones or move items to Phase 2.
