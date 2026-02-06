# Consolidated Active Execution Plans

**Last Updated**: 2026-02-06
**Status**: Authoritative plan for all in-flight and pending tasks.

---

# Execution Plan: BE-003 - BetterAuth Implementation

**Task ID**: BE-003
**Status**: In Progress
**Author**: Enterprise / Solution Architect
**Date**: 2026-02-06

---

## 1. User Stories

-   **As a User**, I want to log in with my email and password so that I can securely access my account and the application's features.
-   **As a User**, I want to log out of the application so that I can end my session and ensure my account is not accessible to others on the same device.
-   **As an Administrator**, I want the authentication system to be secure, reliable, and based on industry best practices to protect user data and maintain system integrity.

## 2. How to Start: Prerequisites & Setup

1.  **Confirm Branch**: Ensure you are on a new feature branch created from `dev`: `git checkout -b feature/BE-003-better-auth`.
2.  **Verify Dependencies**: The `better-auth` library and its peer dependencies (`zod`, `drizzle-kit`) should be correctly installed from the previous steps. If not, resolve them before proceeding.
3.  **Check Database Schema**: Confirm that the `users` table, as defined in `BE-002`, exists and its schema is up-to-date. The `better-auth` adapter relies on this table.
4.  **Environment Variables**: Ensure the following variables are set in your `.env` file for the backend package:
    ```env
    BETTER_AUTH_SECRET=<generate-a-random-64-char-string>
    JWT_SECRET=<generate-a-random-64-char-string>
    ACCESS_TOKEN_TTL_SECONDS=172800
    REFRESH_TOKEN_TTL_SECONDS=2592000
    ```

## 3. What to Look Out For: Risks & Architectural Governance

-   **Architectural Compliance**:
    -   **Config vs. Infrastructure (ADR-005)**: The `auth.config.ts` file MUST remain a plain data object. All client initialization and wiring MUST occur in `infrastructure/better-auth.client.ts`. No exceptions.
    -   **One-Definition-Per-File**: Do not combine the controller, service, and types into a single file. Each must have its own dedicated file.
    -   **No `any` Types**: All variables, especially those handling user data and authentication payloads, must be strictly typed.

-   **Security Risks**:
    -   **Secret Management**: Secrets (`JWT_SECRET`, etc.) MUST be loaded from environment variables and never be hardcoded.
    -   **Error Handling**: Do not expose detailed error messages to the client (e.g., "User not found" vs. "Invalid credentials"). Return generic 401 errors to prevent user enumeration.
    -   **Password Hashing**: `better-auth` handles this automatically with `argon2id`. Do not implement any custom password handling.

-   **Integration Risks**:
    -   **API Contract**: The login endpoint response must strictly match the contract defined in `.docs/02-api-and-data-model.md` to avoid breaking the frontend.
    -   **CORS**: Ensure the `cors` middleware is correctly configured to allow requests from the frontend's origin URL.

## 4. Step-by-Step Implementation Plan

### Phase 1: Configuration & Initialization (Completed)

*This phase was completed in the previous turn.*

1.  **DONE**: Install `better-auth` and resolve peer dependencies.
2.  **DONE**: Create `packages/backend/src/config/auth.config.ts`.
3.  **DONE**: Create placeholder `packages/backend/src/infrastructure/email.client.ts`.
4.  **DONE**: Update `packages/backend/src/infrastructure/better-auth.client.ts` to wire together the configuration, database client, and email service.

### Phase 2: Controller and Endpoint Implementation

1.  **Create Auth Controller**:
    *   Create the file `packages/backend/src/controllers/auth.controller.ts`.
2.  **Implement Login Endpoint**:
    *   Define a `login` method with the `@Post('/login')` decorator.
    *   Use the `@Body` decorator with a Zod schema for request validation.
    *   Call the `betterAuth.login()` method, passing the email and password.
    *   On success, construct and return the response payload (user object, access token, refresh token).
3.  **Implement Logout Endpoint**:
    *   Define a `logout` method with the `@Post('/logout')` decorator.
    -   This endpoint will require authorization, so apply the necessary middleware.
    *   Call the appropriate `betterAuth` method to invalidate the session.
    *   Set the HTTP status to `204 No Content`.

### Phase 3: Validation and Governance

1.  **Write Tests**:
    *   Create `packages/backend/src/__tests__/auth.controller.spec.ts`.
    *   Write tests for the login endpoint: successful login, incorrect password, non-existent user.
    *   Write a test for the logout endpoint.
    *   Ensure test coverage meets or exceeds the 85% requirement.
2.  **Update Documentation**:
    *   Review and update `.docs/02-api-and-data-model.md` to ensure the auth endpoints are accurately documented.
3.  **Submit for Review**:
    *   Create a Pull Request, referencing `BE-003` and this plan.

---
---

# Execution Plan: BE-006 - WebSocket Infrastructure

**Task ID**: BE-006
**Status**: Not Started
**Priority**: HIGH (Critical path for Phase 2)
**Estimated Duration**: 12-14 hours

---

## 1. Objective

Build a production-grade WebSocket server that handles real-time events, manages client connections, and provides a message backlog for clients who disconnect and reconnect.

## 2. Acceptance Criteria

- Socket.io server is configured and running.
- All 8 specified event types are implemented with Zod validation.
- Heartbeat, event backlog, and exponential backoff reconnection are functional.
- Presence tracking and typing indicators are working.
- Test coverage is >= 95%.

## 3. Execution Phases

### Phase 1: Preparation (1 hour)

1.  **Review `FE-004` Deliverables**: Understand the available frontend API hooks and error handling patterns from `packages/frontend/HOOKS_DOCUMENTATION.md`.
2.  **Review WebSocket Requirements**: Understand the 8 event types, heartbeat, backlog, and reconnection logic from `.docs/plans/week2-product-owner-review.md`.
3.  **Review Architecture Patterns**: Understand event serialization, type-safe events, and reconnection strategy from `.docs/plans/week2-architect-review.md`.

### Phase 2: Implementation (Day 1 - 8 hours)

1.  **Setup Socket.io Server**: Initialize the server in `packages/backend/src/infrastructure/websocket/socket-server.ts`, configure CORS, and add authentication middleware.
2.  **Define Event Schemas**: Create Zod schemas and TypeScript types for all 8 events in `packages/backend/src/schemas/websocket-events.ts` and `packages/backend/src/types/websocket.types.ts`.
3.  **Implement Core Event Handlers**: In `packages/backend/src/infrastructure/websocket/event-handlers.ts`, implement the server-side logic for emitting `conversation_updated`, `message.sent`, `message.failed`, and `notification.received`.
4.  **Implement Reconnection Logic**: Configure exponential backoff for the client-side reconnection strategy.

### Phase 3: Advanced Features & Testing (Day 2 - 6 hours)

1.  **Implement Advanced Features**: In `packages/backend/src/services/websocket-service.ts`, implement presence tracking, typing indicators, and the event backlog retrieval logic.
2.  **Write Tests**: Create `be-006-websocket-events.spec.ts` and `be-006-reconnection.spec.ts` covering over 30 scenarios.
3.  **Create Documentation**: Create `packages/backend/WEBSOCKET_DOCUMENTATION.md` detailing usage, events, and integration examples.

## 4. Deliverables

-   5 new core backend files for WebSocket infrastructure.
-   2 new test files with comprehensive scenarios.
-   1 new documentation file.
-   A Pull Request for review.
