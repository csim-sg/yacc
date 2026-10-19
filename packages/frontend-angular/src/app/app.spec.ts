import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/**
 * Bootstrap smoke spec for the unit-test pipeline (ANG-003; updated by
 * ANG-007 for the shell mount).
 *
 * Proves the TestBed + jsdom + Vitest (first-party `@angular/build:unit-test`
 * builder) pipeline end-to-end on the app root: the root renders the W19
 * reconnecting indicator and the router outlet (public routes render
 * directly; the authenticated route group renders the `AppShell`). The
 * shell itself is covered by `components/app-shell/app-shell.spec.ts` —
 * this spec is infrastructure, not feature coverage.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideZoneChangeDetection({ eventCoalescing: true })],
    }).compileComponents();
  });

  it('creates the app root', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the reconnecting indicator and the router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reconnecting-indicator')).toBeTruthy();
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });
});
