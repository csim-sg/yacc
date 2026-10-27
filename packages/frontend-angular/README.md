# @yacc/frontend-angular — Angular target frontend (SPEC-003)

Angular app shell replacing the React SPA (`packages/frontend`) 1:1, built with the Angular CLI (`ng build`) — Vite is not used in this package.

- Architecture + guardrails (placement, single HTTP entry, single socket entry, local contracts only — the shared workspace common package is not adopted — no NgRx/TanStack/NgModules): `.docs/architecture/005-angular-target-frontend-architecture.md` and `ADR-031`.
- Stack: standalone components, Signals, Angular Router + functional guards, HttpClient/RxJS, Tailwind v4 + daisyUI, zone.js change detection.
- Environment substitution is build-time file replacement only: `src/environments/environment.ts` → `environment.prod.ts` (carries the `VITE_API_BASE_URL` / `VITE_WS_URL` equivalents).

## Commands

```bash
npm run dev --workspace @yacc/frontend-angular     # ng serve (port 4200)
npm run build --workspace @yacc/frontend-angular   # ng build -> dist/frontend-angular/browser/
npm run test:unit --workspace @yacc/frontend-angular            # unit suite (see PARITY.md §4)
npm run test:unit:coverage --workspace @yacc/frontend-angular   # PB-3 gate run (≥85/85/85/80 thresholds)
npm run test:e2e --workspace @yacc/frontend-angular             # parity harness (see PARITY.md §3)
```

Testing foundation + parity bar: `PARITY.md` (PB-1/2/3, disposition-register discipline,
parity-critical unit run set, runner decision). React-baseline evidence:
`parity/baseline/`.

Production frontend remains the React package until the approved cutover (ANG-016).
