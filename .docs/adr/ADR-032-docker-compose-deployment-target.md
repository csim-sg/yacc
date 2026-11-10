# ADR-032: Docker Compose Replaces K3s + Helm as the Deployment Target

**Status:** Accepted
**Date:** 2026-11-10
**Owner:** Founder (decision authority); Tech-lead (record)
**Type:** Architecture / Infrastructure
**Supersedes:** ADR-019 (Adopt K3s + Helm as CI/CD Deployment Target)
**Amends:** ADR-029 (JVM Deployment Envelope + Observability — Kubernetes-specific expressions re-expressed for Compose; portable runtime controls unchanged)
**Founder decision record:** verbatim direction "dont use kube anymore. we are changing to simple docker-compose" (2026-11-10), clarified the same day; recorded in csim-sg/yacc#471 (MIG-105) and #472 (MIG-106) and in the SPEC-002 session context note `ctx-964735c8-30ef-4223-8743-716da2c647a3` §"Founder clarified Compose target" / §"Founder deployment-target change". This record covers the YACC repository only; it does not assume authority over other repositories despite the broader organizational Compose-migration direction.

## Context

- The founder replaced the deployment target on 2026-11-10: **Docker Compose replaces Kubernetes for local/dev, staging and production**; the first delivery target is the **local Docker host**; the **API is public**; ingress is **Traefik with HTTPS and `/ws`**; deployment is **manual**; secrets are managed with **SOPS**.
- Three accepted artifacts still asserted K3s/Helm as the target in their own words (ADR-019; ADR-029 pod-envelope expressions; SPEC-002 AC-05/FR-02 "in K3s"; ARCH-004 §11), so the change requires this decision record and the accompanying amendments before any Compose implementation.
- YACC is a single-tenant service operated manually by the founder (with agent assistance) on one Docker host per environment. DNS for `riotingnerds.com` is Cloudflare-managed; the founder will update DNS only once Docker is running. No kubectl/Helm/cluster operations are authorized under this decision.
- Open founder inputs, flagged and **not decided here** (they gate later implementation/exposure steps, not this record): the exact public FQDN/subdomain; whether the local Docker host is publicly reachable or a tunnel (e.g. Cloudflare Tunnel) is required; the SOPS key provider (age/GPG), recipient public key and custody; three named human developers for the SPEC-002 ownership-demonstration criterion (#361).

## Decision

1. **Target:** Docker Compose is the deployment target for **local/dev, staging and production**. The first delivery target is the local Docker host; staging/production Compose environments follow later, each on its own host/project. Single backend instance per environment (ADR-029 single-instance constraint unchanged).
2. **Ingress:** Traefik (as a Compose service) terminates TLS and proxies the public API surface: `/api`, `/health/*` and `/ws` (WebSocket upgrade). Certificate issuance/renewal mode and the exact hostname are pinned by the implementation issue, not here.
3. **Deployment mode:** manual, version-pinned image deployment by the operator. CI builds/tests/publishes images; there is no CI auto-deploy requirement. The existing K3s/Helm deploy path (chart + staging deploy job) is transitional until decommission (MIG-080, #364).
4. **Secrets:** SOPS-encrypted artifacts are the secret medium on Compose targets. Plaintext secret files — including plain `.env` files carrying secret values — are **not** an acceptable default. SOPS provider (age/GPG), recipient public keys and key custody remain open founder inputs; until delivered, no secret material is committed anywhere.
5. **DNS/exposure:** Cloudflare-managed DNS (`riotingnerds.com`), updated by the founder. No DNS edit and no public listener/exposure happens as part of this decision; exposure is a separate, later, founder-gated step.

### What did not change

HTTP/REST and WebSocket contracts (the ADR-023 frozen surface), RBAC and the four-role model, the data model and Flyway schema, the atomic evidence ledger, and every non-deployment SPEC-002 acceptance criterion are unaffected. No `.docs/migration/**` content changes.

### Accepted losses (recorded explicitly, not hidden)

Compose has no scheduler, no probe-driven restart, and no readiness-gated routing. Relative to the K3s/Helm target, the following are **accepted as lost**:

- **Probe-driven restart and readiness-gated routing** — Kubernetes liveness/readiness probes do not exist; an unhealthy-but-running container keeps receiving traffic until manual intervention. Mitigated in scope by: container `healthcheck` on the same `/health/*` wire paths + `restart` policy, and Traefik as the routing layer. Residual risk is accepted and recorded rather than assumed away.
- **Rolling updates / scheduler placement** — deploys are stop-and-replace on one host with a brief planned interruption window. Accepted under the manual, single-tenant, planned-deploy posture.
- **Helm release lifecycle (including `helm rollback`)** — replaced by version-controlled Compose files + pinned image tags; recovery is a re-deploy of the previous pinned tag. The roll-forward-only posture is unchanged; no automated rollback tooling exists.

Not lost: the resource envelope (re-expressed as a container memory/CPU limit contract — ADR-029 amendment), the non-root/read-only-root-FS envelope, `/health/*` wire paths, JSON logs + MDC + Micrometer observability, single-instance operation, and the Quartz + DB-DLQ design.

## Alternatives Considered

- **Keep K3s + Helm (ADR-019):** rejected — the founder explicitly retired Kubernetes ("dont use kube anymore"); cluster lifecycle and Helm discipline are unjustified operational complexity for a single-tenant, manually operated deployment.
- **Managed container platform (Cloud Run/ECS/Fargate-class):** rejected — not decided by the founder; a managed cloud target must not be inferred from the Compose decision.
- **Bare host processes (systemd, no containers):** rejected — the founder named Docker Compose specifically; the container runtime envelope (ADR-029) and image-based deploys are retained.

## Consequences

- **Stability impact:** one host is the total blast radius per environment; there is no automatic failover and no multi-instance operation. Accepted; backup/restore rehearsal, health visibility and a human recovery procedure remain mandatory (SPEC-002 operational substance unchanged). Staging and production run as separate hosts/Compose projects once provisioned.
- **Cost impact:** one Docker host per environment; no cluster overhead. The Helm chart, `deploy/helm/**`, the K3s-shaped deploy job, and the four K3s-shaped runbooks become transitional and are removed or rewritten by MIG-080 (#364) and the Compose implementation issue (#473) — not by this record.
- **Security impact:** the portable runtime envelope survives unchanged (non-root uid 1000, all capabilities dropped, read-only root filesystem, tmpfs for tmp/heap/logs — ADR-029 as amended). Secrets move from cluster Secret objects to SOPS-encrypted artifacts; plaintext is never the default. TLS terminates at Traefik. Host-level access becomes the primary security boundary and must be restricted to the operator (founder, with agent assistance).
- **Operability impact:** manual deploys with healthcheck-gated verification; the staging-evidence procedure and its runbooks change shape — Compose-shaped successors are sequenced after this decision lands (#472 → #473). The evidence rule that a readiness endpoint alone is not deployment proof carries over unchanged: authenticated callable-API evidence is still required.

## Standards Alignment

- TOGAF: technology architecture (deployment topology change).
- AWS Well-Architected: operational excellence (manual, evidence-gated operations, health visibility), reliability (single-host posture with backup/restore + roll-forward discipline), security (least-privilege container envelope, SOPS-encrypted secrets, TLS at the edge, restricted host access).
- ISO controls impacted: access control (operator-restricted host), cryptographic key management (SOPS recipients/custody — pending founder input), backup and recovery (rehearsal gates unchanged).
