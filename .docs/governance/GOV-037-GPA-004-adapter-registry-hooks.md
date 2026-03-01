# GOV-037 – Adapter Registry Hook Lifecycle

**Status**: 🟢 Resolved (blocking PR #324 until QA confirmation)

## Summary
This governance log captures the alignment work for GPA-004 (AdapterRegistry service) that enforces the hook lifecycle contract described in ADR-022. The service now fires `adapter:registered`, `adapter:connected`, `adapter:disconnected`, and `adapter:error` hooks with full payload/context, stores adapters by multi-profile keys, and cleans up stale keys on disconnect/unregister/shutdown.

## Decisions
1. **Hook Payload Contract** – Each lifecycle hook carries `platform`, optional `key`, adapter context, correlation IDs, and the relevant data (config, reason, error). Hook failures are non-blocking and logged; errors populate the `errors` array returned by `gatewayHooks.do()`.
2. **Boolean Lifecycle Results** – `connect()` and `disconnect()` return explicit `true|false` outcomes so callers can respond to failed wiring (not just rely on thrown errors).
3. **Multi-Profile Cleanup** – The registry tracks adapters by `config.key` and removes the matching entry whenever the adapter is disconnected or unregistered. `shutdown()` clears the key map after calling `disconnect()` for each platform.
4. **Documentation** – `.docs/07-hooks.md` now contains lifecycle guarantees, naming conventions, and a multi-profile key policy. `.docs/plans/00-INDEX.md` reflects the in-review status of the Gateway Plugin Architecture, and `.docs/06-tasks.md` shows the actual statuses for GPA-001 through GPA-004.

## Tests & Verification
- `packages/backend/test` (targeted to `adapter-registry.service.spec.ts` and full backend suite; output attached in PR comment). All adapter-registry tests pass after the hook wiring change. The remaining `test-full` failure is tracked in the PR due to unrelated pre-existing failures (audit-logs). Full suite verification remains part of the QA handoff.

## Follow-up
- QA must confirm the hook contract via regression tests (adapter lifecycle hooks + multi-profile lookup). Once `test-full` passes and QA signs off, the architect can unblock PR #324.
- No additional ADR is required; this log completes the governance trail for GPA-004.
