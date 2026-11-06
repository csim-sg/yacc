# YACC — Agent Context

YACC is a self-hosted omnichannel customer support platform: a shared inbox for conversations from IRC, webchat, WhatsApp, social chat, and Telegram. The product direction includes ticket management, integration with an organisation’s internal CRM, and a simple built-in CRM, alongside role-based access (Super Admin, Admin, Manager, User), real-time updates, routing rules, notifications, search and audit logging. These are target capabilities, not a claim that all are implemented. Consult `.docs/01-product-specification.md` for documented scope and acceptance criteria, and verify implementation status separately.

This file describes the target architecture and durable working conventions. Consult `.docs/plans/00-INDEX.md` for implementation and migration status; do not infer completion from the target architecture described here.

## Repository and delivery

- Repository: `csim-sg/yacc`; pull requests target `dev`.
- GitHub Project #1 is the workflow board. Source `.github-project.env` for runtime field IDs, board options, worktree root and central docs vault paths; do not hardcode older values.
- Milestones represent specs; issues represent execution tasks. Tech-lead owns milestones and task issues. Strategist shapes scope, tech-lead handles technical planning, builder implements, and reviewer owns the review gate.
- Work in an issue branch and dedicated worktree from `dev`; implement with tests and relevant documentation, open a PR to `dev`, and address review in the same branch. Merge only after explicit approval. Escalate after eight review loops. Tech-lead cleans up the worktree and branch.
- No force pushes or direct commits to `dev`/`main`. Use `feat(scope):`, `fix:`, `docs:`, `refactor:`, `test:` or `chore:` prefixes.
- Use issue comments for task handoffs and decisions, PR descriptions for implementation and verification, PR review threads for review, and the project board for state. The central vault is for durable knowledge, not task transcripts.

## Target architecture

### Frontend

- `packages/frontend-angular` — Angular 21, standalone components, Signals and injectable signal stores, Angular Router, HttpClient, RxJS, Tailwind v4 and daisyUI. Build with Angular CLI; use local Zod contracts, not `@yacc/common`.
- Follow `.docs/architecture/005-angular-target-frontend-architecture.md` and ADR-031: flat feature folders, single HTTP entry, single real-time service, functional guards and interceptors, and no NgModules, NgRx or TanStack. The accepted frontend design specifies Socket.io for the real-time client.

### Backend

- `services/backend-java` — target Java 25 LTS, Spring Boot, Spring Security and embedded Spring Authorization Server; PostgreSQL, Spring Data JPA and Flyway; Quartz and a database-backed DLQ; raw Spring WebSocket; JUnit 5 and Testcontainers.
- Follow `.docs/architecture/004-java-backend-guardrails.md` and ADR-023 through ADR-030. Use standalone `com.yacc.api.<feature>` modules with shared `entity`, `repository`, and `service` planes plus `config` and `common`; keep `YaccApplication` at the root. Use constructor injection, typed configuration, bean validation, and repositories for persistence.
- The backend real-time contract uses raw WebSocket at `/ws`, with the `{event,data,timestamp}` envelope; no Socket.io, STOMP or SockJS. The accepted Angular design specifies Socket.io, which is not wire-compatible with raw WebSocket. Do not assume integration works or silently change either architecture: consult the relevant decisions and resolve the mismatch explicitly.
- The frozen `.docs/migration/{openapi.yaml,asyncapi.yaml,schemas/*}` is the backend contract source of truth (ADR-023); do not edit it under GOV-038.

## Tools and commands

- Target runtimes are Node.js 24 LTS and Java 25 LTS; npm manages the Node workspaces. Existing build configuration and CI still require reconciliation with these targets; verify compatibility before changing runtime pins. Docker is required for Testcontainers-backed tests.
- `docker compose up -d` starts PostgreSQL 15 (`yacc_user` / `yacc_password` / `yacc_inbox`, port 5432) and Mailhog (SMTP 1025, UI 8025). The Java backend does not use Redis.

```bash
npm run dev --workspace @yacc/frontend-angular
npm run build --workspace @yacc/frontend-angular
npm run test:unit --workspace @yacc/frontend-angular
npm run test:e2e --workspace @yacc/frontend-angular

cd services/backend-java
./gradlew --no-daemon bootRun
./gradlew --no-daemon test
./gradlew --no-daemon contractTest
./gradlew --no-daemon check
```

Java startup requires the configured signing key, integration encryption key and appropriate bootstrap credentials. The PostgreSQL JDBC driver is currently declared `testRuntimeOnly`, so plain `bootRun` may fail without a runtime driver. See `.docs/runbooks/react-e2e-baseline-capture.md` for the recorded local boot method; never commit secrets. See `packages/frontend-angular/README.md` and `PARITY.md` for frontend setup and test prerequisites.

## Documentation and deployment

- `.docs/01-product-specification.md` — product scope and acceptance criteria.
- `.docs/plans/00-INDEX.md` — current delivery status.
- `.docs/architecture/004-java-backend-guardrails.md` and `005-angular-target-frontend-architecture.md` — target architecture and guardrails.
- `.docs/adr/` — architecture decisions; `.docs/migration/` — frozen contracts.
- `.docs/04-qa-and-testing.md`, `.docs/runbooks/`, `.docs/security/` and `.docs/governance/` — testing and operations.
- **Deployment target:** Docker Compose. The current `docker-compose.yml` starts supporting services only; do not assume it deploys the full application. Existing Helm and staging workflows do not represent the newly stated target and require separate reconciliation. `backend-java-ci.yml` provides Java CI.

Keep the status index, relevant ADRs and governance records in sync when applicable. If documentation and actual manifests or workflows disagree, verify the implementation and flag the discrepancy rather than assuming either is current.
