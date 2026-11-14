# Obscura engine-delta reproductions (ANG-015-P7a, #501)

Raw-CDP reproductions of the two measured Obscura engine deltas that block
SPEC-003's Obscura-only CI gate (Stage 1 of #496; the original measurement is
the #490 spike, [SPIKE-REPORT evidence record](https://github.com/csim-sg/yacc/issues/490#issuecomment-6846415636)).

They are **engine-only**: no YACC app, no frozen suite file, no Playwright
test file. Each script serves its own one-page static fixture, drives the
engine over raw CDP with Node built-ins (no dependencies; Node >= 22 for the
global `WebSocket` client), prints **expected vs observed plus the engine
identity and image digest**, and **exits non-zero on the defective
behaviour** — so a future fixed release flips them automatically.

| Script | Delta | Frozen case identity |
|---|---|---|
| `repro-history-traversal.mjs` | JS `history.back()` appends a duplicate history entry (index never moves back); CDP `Page.navigateToHistoryEntry` (Playwright `goBack`) replaces the document, fires no `popstate`, and rewrites the entry list | `ANG007-INBOX-1` — `packages/frontend/tests/inbox-shell-ang007.spec.ts:108` |
| `repro-form-label-layout.mjs` | An inline `<label>` in a run containing an atomic inline `<input>` gets a 0x0 box with `offsetParent === null` while a byte-identical-class sibling label (block sibling) renders normally (upstream #722) | `should have proper form labels for accessibility` — `packages/frontend/tests/fe-002-login-ui.spec.ts:56` |

## Recorded digests (2026-11-13)

| Version | Image digest | Status for these deltas |
|---|---|---|
| v0.2.5 | `sha256:354c3d2a0fa2dd2939debe6903aa26c35d121329245dfa42aa7d1c292a209814` | deltas present (original spike measurement) |
| v0.2.6 | `sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c` | deltas present — **expected pre-fix state; scripts exit 1 here** |

Note: obscura's `/json/version` impersonates a Chrome build and does **not**
expose its own release version, so the caller-supplied `--digest` is the
authoritative identity and every script prints it (and fails closed with
exit 2 if it is not supplied).

## Running against an engine

Start a **digest-pinned** container on a spare loopback address (do not reuse
a shared engine; loopback-range binds are auth-exempt, so no token is
involved):

```sh
docker run -d --rm --name obscura-repro --network host \
  -e OBSCURA_TIMEZONE=UTC \
  h4ckf0r0day/obscura@sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c \
  serve --port 9222 --host 127.0.0.2 --allow-private-network
```

```sh
node packages/frontend-angular/parity/engine-deltas/repro-history-traversal.mjs \
  --ws=http://127.0.0.2:9222 \
  --digest=sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c
node packages/frontend-angular/parity/engine-deltas/repro-form-label-layout.mjs \
  --ws=http://127.0.0.2:9222 \
  --digest=sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c
```

The scripts only need to reach the engine endpoint; `--allow-private-network`
is required because obscura's SSRF guard refuses loopback targets otherwise.
The engine never needs to reach the scripts' fixture server beyond
`127.0.0.1` either — the fixture server binds loopback and the engine runs
with `--network host`, so both see the same loopback.

Tear the container down afterwards: `docker rm -f obscura-repro`.

## Interpreting pass/fail

- **exit 1** = the measured defective behaviour is present. On v0.2.6 this
  is the documented pre-fix state; it is **not** a harness failure.
- **exit 0** = the engine behaved to spec for that delta (what a fixed
  release must produce).
- **exit 2** = usage/connectivity error (missing `--ws`/`--digest`, engine
  unreachable) — never treated as either pass or defect.

Each script prints every check as explicit `EXPECTED` / `OBSERVED` pairs
plus the engine `/json/version` payload and the caller-supplied digest, so
the output is self-describing evidence.

## How #496 Stage 2 uses this

At the first release/digest that claims to contain the fixes, run **both
scripts** against the new digest:

- Both **exit 0** → necessary condition met; the authoritative Stage 2
  acceptance remains #496 AC-4/AC-5: the two frozen cases pass **unmodified**
  in the Obscura project at that digest, a chromium control is green for the
  same rows, and the recorded 6-file/270-row re-measurement shows no new
  engine-attributable deltas. This harness is the cheap machine-checkable
  gate, not a substitute for the frozen-suite verification.
- Any **exit 1** → the release does not fix the delta; #496 stays Blocked
  and the output (with the digest) is the evidence.

The chromium expectation (both scripts exit 0 on real Chrome/Chromium) is
part of the recorded evidence: a real-chromium control run is the definition
of "expected" for both deltas.
