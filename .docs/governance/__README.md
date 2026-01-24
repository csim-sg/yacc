# Log Entry Template

```
Date:
Change / PR / ADR ID:
Decision:
Reason:
Architect:
Impacted Systems:
Risk Level: Low | Medium | High
Follow-up Required: Yes | No
```

# Rules

* Stored in `.docs/governance/GOV-<running number>-<short name description>.md`
* Append-only (no deletions)
* Referenced during audits and reviews

# Sign-off Protection (Recommended)

Use GitHub branch protection + CODEOWNERS to enforce sign-off control for ADR/GOV files:

1) Add `.github/CODEOWNERS` entries for:
   - `/docs/adr/*`
   - `/docs/governance/*`
2) Protect the main branch and require:
   - Pull request reviews
   - Code owner approval
   - Optional: signed commits and passing status checks

This creates an auditable trail where signed-off documents can only change via reviewed PRs.
