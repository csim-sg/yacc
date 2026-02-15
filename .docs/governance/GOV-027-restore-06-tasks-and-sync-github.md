Date: 2026-02-14
Change / PR / ADR ID: ADR-016
Decision: Restore `.docs/06-tasks.md` and synchronize GitHub Issues + Project item statuses for tracked tasks.
Reason: `.docs/06-tasks.md` is required as the canonical mapping layer between task IDs and GitHub artifacts.
Architect: Enterprise Architect
Impacted Systems: Documentation + GitHub Issues + GitHub Project
Risk Level: Medium
Follow-up Required: Yes

---

## Actions Performed
1. Restored `.docs/06-tasks.md` to repo HEAD.
2. Closed completed GitHub issues referenced by `.docs/06-tasks.md` and aligned their Project Status to `Done`.
3. Deduplicated WebSocket issues (closed duplicates created later for BE-017/018/019).

## Follow-ups
1. Review remaining open issues that are already implemented but not referenced in `.docs/06-tasks.md`.
2. Ensure Phase 2 tasks have consistent task IDs and GitHub issue mappings.
3. Add labels for `post-mvp` / `deferred` if the team wants explicit tracking in GitHub.
