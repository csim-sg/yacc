# ADR-029: JVM Deployment Envelope + Observability

**Status:** Accepted
**Date:** 2026-09-24
**Owner:** Tech-lead (technical author), Founder (decision authority)
**Type:** Architecture / Infrastructure
**Amends:** ADR-019 (K3s/Helm pod spec), ADR-004 (logging)

## Context

A Spring Boot service + connectors + worker does not fit the current pod envelope (500m/512Mi request / 1Gi limit) and needs read-only-root-FS / non-root compliance. Logging and metrics must preserve field/metric parity.

## Decision

- **Runtime:** Temurin 21 JRE base image, non-root (runAsUser 1000, drop ALL caps), read-only root FS (point `java.io.tmpdir`, heap dumps, logs to emptyDir).
- **Pod envelope:** ≥ 1Gi request / 2Gi limit (re-specify Helm `deploy/helm/yacc-backend`).
- **Probes:** remap to `/actuator/health/{liveness,readiness}` or custom `/health/*`.
- **Ports/secrets:** reconcile Spring default port/service mapping; replace `JWT_SECRET`/`BETTER_AUTH_SECRET` with Spring auth + recovery secrets.
- **Observability:** SLF4J/logback structured JSON (field-shape parity with pino), MDC correlationId, Micrometer + `/actuator/prometheus`, audit via Spring Security events + audit table; SLO parity retained.

## Alternatives Considered

- **Keep 512Mi/1Gi envelope:** rejected — insufficient for Spring Boot + connectors + worker (JVM memory footprint).
- **Separate worker pod:** rejected — single-instance constraint; in-process Quartz worker.

## Consequences

- Amends ADR-019 (pod spec) and ADR-004 (logging); Helm chart rewritten.
- Operational readiness gate (AC-05) requires non-root/read-only-FS compliance and correct envelope.

## Standards Alignment

- AWS Well-Architected: security (least privilege), operational excellence (observability).
- TOGAF: technology architecture.
