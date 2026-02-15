Date: 2026-02-14
Change / PR / ADR ID: ADR-015
Decision: Remove pre-MVP working documents from repo HEAD; no `.docs/archive/` maintained.
Reason: MVP reached; working docs create navigation noise and ambiguity. Audit trail remains via ADR/GOV + git history.
Architect: Enterprise Architect
Impacted Systems: Documentation only (`.docs/`, repo root)
Risk Level: Low
Follow-up Required: Yes

---

## What Changed
1. Removed (from HEAD) pre-MVP working documents:
   - phase packets / PR-ready bundles
   - session notes
   - inactive planning docs
   - start-here files tied to past PRs
2. Kept authoritative docs:
   - Tier 1 core docs (`.docs/01-05-*`, `.docs/README.md`)
   - Tier 2 governance (`.docs/adr/*`, `.docs/governance/*`)

## Auditability Statement
This change does not remove historical content from version control.
All removed documents remain retrievable via git history.

## Follow-ups
1. Update `.docs/README.md` to reflect MVP-stage doc navigation.
2. Update `.docs/plans/00-INDEX.md` to MVP COMPLETE and remove references to inactive plans.
