import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/**
 * Bootstrap smoke spec for the unit-test pipeline (ANG-003).
 *
 * Proves the TestBed + jsdom + Vitest (first-party `@angular/build:unit-test`
 * builder) pipeline end-to-end on the app shell. Component behavior itself is
 * E2E's job (PARITY.md, PB-3 scope) — this spec is infrastructure, not feature
 * coverage. Feature ports (ANG-004+) replace this with the parity-critical
 * run set defined in PARITY.md.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideZoneChangeDetection({ eventCoalescing: true })],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the application title signal', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('YACC — Yet Another Chat Client');
  });
});
