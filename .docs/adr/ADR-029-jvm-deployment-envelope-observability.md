# ADR-029: JVM Deployment Envelope + Observability

**Status:** Accepted — **Amended 2026-11-10 (ADR-032 / MIG-106 #472): Kubernetes-specific expressions replaced with Compose equivalents; portable runtime contract unchanged — see amendment note**  
**Date:** 2026-09-24  
**Owner:** Tech-lead (technical author), Founder (decision authority)  
**Type:** Architecture / Infrastructure  
**Amends:** ADR-019 (K3s/Helm pod spec), ADR-004 (logging)

> **Amendment note (2026-11-10, ADR-032 / MIG-106 #472).** The deployment target is now
> Docker Compose (ADR-032 supersedes ADR-019). This ADR's contract splits as follows;
> the original decision content below is retained unchanged.
>
> **Survives unchanged (portable runtime contract):** Temurin 21 JRE base image;
> non-root (runAsUser 1000, drop ALL caps); read-only root filesystem with tmpdir,
> heap-dump and log locations on non-root-writable ephemeral storage; `/health/*` wire
> paths (`/health`, `/health/live`, `/health/ready`); SLF4J/logback structured JSON
> (field parity), MDC correlationId, Micrometer + `/actuator/prometheus`; audit via
> Spring Security events + audit table; single instance per environment.
>
> **Replaced (Kubernetes-specific expressions → Compose equivalents):**
> (1) *Pod envelope* (≥ 1Gi request / 2Gi limit, Helm `deploy.resources`) → the same
> envelope restated as a **container memory limit contract** — at least 1 Gi reserved,
> capped at 2 Gi — plus an explicit CPU limit; exact Compose expressions and values are
> pinned by the Compose implementation issue (#473). The requirement survives; only the
> vocabulary changed. (2) *emptyDir volumes* → tmpfs mounts / named volumes for tmpdir,
> heap dumps and logs. (3) *Kubernetes liveness/readiness probes* → container
> `healthcheck` on the same `/health/*` wire paths plus a `restart` policy, with Traefik
> as the routing layer; probe-driven restart and readiness-gated routing are accepted
> losses recorded in ADR-032, not silent drops.

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
