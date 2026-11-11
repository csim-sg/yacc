# YACC — Yet Another Chat Client

**One shared inbox for customer conversations, wherever they start.**

YACC is a self-hosted customer support platform for organisations that want to bring messages from different channels into one place. It aims to help a team manage conversations together, track customer requests as tickets, and connect support work with customer information.

## Who is YACC for?

YACC is intended for organisations and support teams that receive customer messages across multiple channels and want a shared way to manage them. It is designed to be hosted by the organisation or its chosen operator, rather than requiring a hosted service. Hosting also means the operator is responsible for deployment, maintenance, backups, security, and any channel-provider accounts or fees.

## What YACC aims to provide

- **A shared inbox:** bring customer conversations together so a team can see and respond to messages without managing each channel separately.
- **Channel choice:** target IRC, webchat, WhatsApp, social chat, and Telegram. Specific social platforms and provider requirements have not been defined here.
- **Ticket management:** track customer requests through a support workflow, in the spirit of a help desk such as Zendesk.
- **Customer context:** integrate with an organisation’s internal customer relationship management (CRM) system, with a simple built-in CRM also envisioned.
- **Team coordination:** use assignments, routing rules, notifications, search, and role-based access to organise support work.
- **Accountability:** retain an audit trail of relevant activity.

For example, a customer might contact a team through webchat; the team would handle the conversation in the shared inbox, track the request as a ticket, and use customer context to help with follow-up. This is an illustration of the intended workflow, not a statement that the complete workflow is available today.

## Before evaluating or deploying

The capabilities and channels above describe the **product direction**, not a guarantee of availability or production readiness. CRM integration, the built-in CRM, ticketing details, and individual channel support need to be confirmed against the current implementation before planning a deployment. See the [execution status index](.docs/plans/00-INDEX.md) and [product specification](.docs/01-product-specification.md); the specification may not yet reflect the complete direction described here.

## For developers and operators

### Target technology

- **Frontend:** Angular 21, standalone components, Signals, Angular Router, HttpClient, RxJS, Tailwind CSS and daisyUI. The accepted frontend design specifies a single Socket.io client service for real-time events; see the [frontend architecture](.docs/architecture/005-angular-target-frontend-architecture.md).
- **Backend:** Java 25 LTS and Spring Boot, Spring Security and embedded authorization server, PostgreSQL with Spring Data JPA and Flyway, Quartz and a database-backed dead-letter queue. Real-time transport is raw Spring WebSocket; see the [backend guardrails](.docs/architecture/004-java-backend-guardrails.md).
- **Contracts:** [OpenAPI, AsyncAPI and schemas](.docs/migration/) define the backend wire contracts. The Angular app maintains its own local typed contracts.
- **Deployment:** Docker Compose is the intended deployment approach. The existing [Compose configuration](docker-compose.yml) provides local supporting services; a complete application deployment configuration is not yet established here.

**Real-time integration constraint:** the accepted frontend architecture specifies Socket.io, whereas the backend architecture specifies raw WebSocket. These protocols are not interchangeable. Do not assume end-to-end real-time compatibility without an explicit resolution and verification.

### Project layout

- [`packages/frontend-angular/`](packages/frontend-angular/) — Angular frontend and [frontend-specific commands](packages/frontend-angular/README.md).
- [`services/backend-java/`](services/backend-java/) — Spring Boot backend.
- [`docker-compose.yml`](docker-compose.yml) — local supporting services; Docker Compose is the intended deployment approach.
- [`.docs/`](.docs/) — product, architecture, contracts, testing and operational documentation.

## Development

Target prerequisites: Node.js 24 LTS with npm, Java 25 LTS, and Docker with Compose. Runtime compatibility with these targets must be verified against the build configuration and CI.

```bash
git clone https://github.com/csim-sg/yacc.git
cd yacc
npm install
docker compose up -d
npm run dev --workspace @yacc/frontend-angular  # http://localhost:4200
```

Compose starts PostgreSQL (`yacc_inbox`, port 5432) and Mailhog (SMTP port 1025, web UI <http://localhost:8025>). Configure the frontend's API and real-time endpoints as described in its [README](packages/frontend-angular/README.md).

### Backend startup

The backend defaults to PostgreSQL at `localhost:5432/yacc_inbox`; Flyway manages the schema. Supply the authentication signing key, integration encryption key and first-run bootstrap credentials described in [`application.yml`](services/backend-java/src/main/resources/application.yml). Keep credentials out of version control.

The PostgreSQL JDBC driver is currently declared as a test-only runtime dependency in [`build.gradle.kts`](services/backend-java/build.gradle.kts), so plain `bootRun` may fail without a driver on the runtime classpath. The [baseline runbook](.docs/runbooks/react-e2e-baseline-capture.md) records a local boot method and the necessary configuration. Once those prerequisites are supplied:

```bash
cd services/backend-java
./gradlew --no-daemon bootRun  # default port 8080
```

## Build and test

```bash
npm run build --workspace @yacc/frontend-angular
npm run test:unit --workspace @yacc/frontend-angular
npm run test:e2e --workspace @yacc/frontend-angular

cd services/backend-java
./gradlew --no-daemon test
./gradlew --no-daemon contractTest
./gradlew --no-daemon check
```

Java integration tests may require Docker. Frontend E2E tests require a configured test environment; see the [frontend parity guide](packages/frontend-angular/PARITY.md) and [testing strategy](.docs/04-qa-and-testing.md).

## Documentation and contribution

- [Agent context and guardrails](AGENTS.md)
- [Product specification](.docs/01-product-specification.md)
- [Angular frontend architecture](.docs/architecture/005-angular-target-frontend-architecture.md)
- [Java backend guardrails](.docs/architecture/004-java-backend-guardrails.md)
- [Architecture decisions](.docs/adr/)
- [Testing strategy](.docs/04-qa-and-testing.md)

Follow the applicable architecture guardrails, add tests for changes, and update relevant documentation. Pull requests target `dev`; see [AGENTS.md](AGENTS.md) for the delivery workflow.

## License

MIT — see [LICENSE](LICENSE).
