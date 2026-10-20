import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppShell } from './app-shell';

/**
 * AppShell spec (W2/W23): the authenticated layout renders the sidebar
 * navigation, the header (with the NotificationCenter mount) and the
 * routed content; the shell owns the mobile drawer state — the header
 * toggle opens it, the overlay and the navigation close request close it.
 */
describe('AppShell', () => {
  let fixture: ComponentFixture<AppShell>;
  let http: HttpTestingController;

  const session = {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@yacc.local',
      name: 'System Administrator',
      role: 'super_admin',
      status: 'active',
      emailVerified: true,
      createdAt: '2026-09-27T08:00:00',
      updatedAt: '2026-09-27T08:00:00',
    },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    mustChangePassword: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);

    localStorage.setItem('yacc_token', 'access-1');
    fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    http.expectOne('/api/auth/get-session').flush(session);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    localStorage.clear();
  });

  it('renders the navigation, the header and the routed content slot', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-navigation')).toBeTruthy();
    expect(el.querySelector('app-header')).toBeTruthy();
    expect(el.querySelector('main')).toBeTruthy();
    expect(el.querySelector('main router-outlet')).toBeTruthy();
    // NotificationCenter mounted once, inside the header.
    expect(el.querySelectorAll('app-notification-center')).toHaveLength(1);
  });

  it('opens the drawer from the header toggle and closes it on the overlay', () => {
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('button[aria-label="Toggle menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const nav = el.querySelector('nav[aria-label="Main navigation"]') as HTMLElement;
    expect(nav.getAttribute('class')).toContain('translate-x-0');
    expect(el.querySelector('.bg-black\\/50')).toBeTruthy();

    (el.querySelector('.bg-black\\/50') as HTMLElement).click();
    fixture.detectChanges();

    expect(nav.getAttribute('class')).toContain('-translate-x-full');
    expect(el.querySelector('.bg-black\\/50')).toBeNull();
  });

  it('closes the drawer from the navigation close request', () => {
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('button[aria-label="Toggle menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('button[aria-label="Close navigation"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const nav = el.querySelector('nav[aria-label="Main navigation"]') as HTMLElement;
    expect(nav.getAttribute('class')).toContain('-translate-x-full');
  });
});
