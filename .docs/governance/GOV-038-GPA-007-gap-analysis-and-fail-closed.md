# GOV-038: GPA-007 Gap Analysis + Fail-Closed Decision

**Date**: 2026-03-01

## Context

We are starting Gateway Plugin Architecture task **GPA-007** (Update GatewayExchange to use hook system).

During requirements alignment, prior references to **"GPT-005/006/007"** were confirmed to be a typo and map to **GPA-005/006/007** in `.docs/06-tasks.md`.

`GPA-007` is executed as a single issue with a single branch and PR, per workflow.

## Decision

GatewayExchange behavior for hook and adapter resolution failures is **fail-closed**:

- If an adapter cannot be resolved via AdapterRegistry, GatewayExchange must stop processing the affected flow and return a failure outcome.
- If a hook handler errors/rejects at a required step, GatewayExchange must stop processing the affected flow and return a failure outcome.
- These failures must be observable (logged and/or audit logged as appropriate) and must not silently fall back to legacy direct adapter calls.

## Scope Lock

- In scope: **GPA-007 only**
- Out of scope: GPA-008/009/010 (downstream work)

## Implications

- QA must validate fail-closed behavior for missing adapter and hook failure paths.
- No ADR is required if implementation stays within ADR-022 and `.docs/07-hooks.md` contracts.
