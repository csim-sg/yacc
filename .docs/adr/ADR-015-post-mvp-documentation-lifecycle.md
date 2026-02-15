**Status:** Accepted  
**Date:** 2026-02-14  
**Deciders:** Enterprise Architect + Product Owner  
**Related:** ADR-008, GOV-011, GOV-017

---

# Architecture Decision Record

## Title
Post-MVP Documentation Lifecycle: Remove Pre-MVP Working Docs From HEAD (No Archive Folder)

## Context / Problem Statement
During Phase 1 and Phase 2 execution, the repository accumulated a large set of working documents (plans, session notes, phase checklists, PR-specific summaries).

Now that Phase 1 and Phase 2 are complete and the product is at MVP stage, these pre-MVP working docs:

1. Increase navigation noise for ongoing work.
2. Create ambiguity about what is authoritative vs historical.
3. Duplicate information already captured in Tier 1 core docs and Tier 2 governance artifacts.

ADR-008 established an archival approach for Tier 3 planning docs.
However, maintaining an explicit `.docs/archive/` tree is not required for auditability because git history already preserves all prior document versions.

## Decision
1. Treat **Tier 1** (core docs) and **Tier 2** (ADR/GOV) as the only always-current documentation surface at MVP.
2. Remove pre-MVP working documents (Tier 3 planning docs, session notes, phase checklists, PR-ready packets) from the repository HEAD.
3. Do **not** maintain a `.docs/archive/` directory structure.
4. Preserve auditability by relying on:
   - git history for removed documents
   - release tags / commit SHAs referenced from governance entries when needed

## Scope
This ADR applies to documentation only.

**In scope (remove from HEAD):**
- Phase execution packs (e.g., `PHASE-*` summaries)
- Planning docs in `.docs/plans/` that are no longer active
- Session notes and one-off execution logs
- Start-here onboarding guides that refer to past PRs

**Out of scope (must remain in HEAD):**
- `.docs/01-05-*` core documents (Tier 1)
- `.docs/adr/*` ADRs (Tier 2)
- `.docs/governance/*` governance logs (Tier 2)
- Architecture documents required for governance and audits

## Consequences
1. ✅ Repo HEAD stays clean and MVP-focused.
2. ✅ Historical context remains accessible via `git log`.
3. ⚠️ File-path references inside older ADR/GOV documents may no longer resolve in HEAD.
   - Mitigation: use git history; optionally add commit SHAs in a new GOV entry when required.
4. ⚠️ This supersedes the *archive folder* aspect of ADR-008 (the 3-tier model remains).

## Guardrails
1. Do not delete or rewrite ADR/GOV history to "fix links".
2. When removing a widely-referenced working doc, either:
   - update current Tier 1 docs to remove dependency, or
   - add a GOV entry that records where to retrieve the historical content (commit SHA/tag).

## Mermaid – Documentation Surface After MVP
```mermaid
flowchart TD
  A[Developers / QA / PO] --> B[Tier 1 Core Docs (.docs/01-05 + .docs/README.md)]
  A --> C[Tier 2 Governance (.docs/adr + .docs/governance)]
  A -. historical retrieval .-> D[Git History / Tags]

  B --> E[Product / API / Implementation / QA / Quick Ref]
  C --> F[Decision Rationale + Audit Trail]
  D --> G[Removed pre-MVP working docs]
```

## Related
1. ADR-008: Documentation Governance Framework (tier model)
2. GOV-017: Plans directory cleanup decision
3. GOV-011: Documentation cleanup approval
