# Phase 1 Todo

Date: January 18, 2026

## Backend
- Implement JWT-only auth with BetterAuth bearer plugin and TTL env vars
- Add refresh token rotation (single-use) stored in HttpOnly cookie
- Ensure logout behavior documented (no blacklist in Phase 1)
- Finish/verify schema migrations for Phase 1 tables
- Ensure inbox endpoints with filters, pagination, and consistent response shapes
- Apply full RBAC checks on status/priority/assign/tag endpoints
- Implement audit logging for conversation actions only
- Add WebSocket gateway (events: conversation updates, message sent/failed, notifications, presence) at end of Phase 1
- Implement message retry queue (Redis + BullMQ backoff 1m/5m/30m) and DLQ at end of Phase 1
- Confirm Telegram ingestion work is deferred to Phase 2

## Frontend
- Build login flow using JWT access token and refresh cookie
- Add forgot-password and reset-password UI flow
- Implement inbox list, conversation view, and message list integration
- Wire API response shapes and error handling to match backend
- Handle WebSocket connection, reconnection, and event updates

## Docs
- Update Phase 1 scope docs with WebSocket + retry queue at end of Phase 1
- Update auth docs for JWT-only BetterAuth bearer flow
- Document ACCESS_TOKEN_TTL_SECONDS and REFRESH_TOKEN_TTL_SECONDS
- Document refresh token rotation and HttpOnly cookie usage
- Update API response shape examples and error codes

## Infra
- Provision Redis for retry queue (Phase 1 end)
- Provision PostgreSQL and migrations for updated schema
- Add env vars for JWT TTLs and cookie settings
- Ensure WebSocket port/path is accessible in deployment
