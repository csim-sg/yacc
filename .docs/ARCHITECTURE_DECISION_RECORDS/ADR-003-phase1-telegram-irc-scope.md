**Status:** Accepted  
**Date:** 2026-01-24  
**Deciders:** Architecture Team, Product Owner  
**Technical Story:** Phase 1 Scope Alignment

---

# Architecture Decision Record

## Context / Problem Statement
Phase 1 scope drifted to IRC-only in some artifacts and code, while the business requirement is to deliver both Telegram and IRC integration in Phase 1. We need an explicit decision to restore Telegram to Phase 1 and align documentation and implementation with that scope.

## Drivers & Constraints
- MVP requires Telegram and IRC integrations.
- Avoid breaking future channel expansion (email, slack, etc.).
- Maintain existing channel_type enum compatibility.
- Minimize rework by aligning documentation and tests with scope.

## Assumptions
- Telegram integration is part of the Phase 1 deliverable set.
- Future channels remain defined in enums for forward compatibility.

## Options Considered
1. Keep IRC-only in Phase 1 and defer Telegram to Phase 2.
2. Restore Telegram to Phase 1 scope and keep IRC alongside it. ✅

## Decision
Phase 1 scope includes **both Telegram and IRC** integrations. The channel_type enum remains inclusive of future channels to avoid unnecessary churn.

## Implications & Consequences
- Documentation must explicitly state Phase 1 includes Telegram + IRC.
- API schemas and frontend filters must accept Telegram.
- Tests must validate Telegram filters and behavior in Phase 1.
- Future channels (email, slack) remain in enums but are not part of Phase 1 acceptance criteria.

## Architecture Principle Alignment
- **API-First Integration:** supports required platforms in MVP.
- **Reuse Before Build:** avoids churn by keeping future channel types.
- **Secure by Design:** no change to auth/permissions.

## Security / Compliance Impact
- No new security impact beyond Telegram integration requirements.

## Operational Impact
- Integration ops for Telegram must be included in Phase 1 rollout.

## Cost / Complexity Impact
- Moderate: documentation and validation updates required.

## Risks & Mitigations
- **Risk:** Partial documentation updates create ambiguity.  
  **Mitigation:** Update all Phase 1 scope references and acceptance criteria.

## Traceability
- Phase 1 MVP scope
- PR #142 (scope alignment and related blockers)

## Implementation Notes
- Re-enable Telegram in channel enums and schema validation.
- Update tests to validate Telegram filters.
- Update scope references in product and implementation docs.

## Mermaid (Decision Flow)
```mermaid
flowchart TD
  A[Phase 1 scope ambiguity] --> B{Options}
  B --> C[IRC-only Phase 1]
  B --> D[Telegram + IRC Phase 1]
  D --> E[Decision: Restore Telegram to Phase 1]
```

## Sign-off
Approved by: [Pending Architect Sign-off]
