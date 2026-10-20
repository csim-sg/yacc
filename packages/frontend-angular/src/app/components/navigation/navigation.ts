import { Component, computed, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { getAccessibleNavItems } from '../../lib/navigation';
import { AuthService } from '../../services/auth.service';
import type { NavigationItem } from '../../types/navigation-item';

/**
 * Navigation (React `Navigation.tsx` port — W23).
 *
 * Role-based sidebar: items come from the delivered `getAccessibleNavItems`
 * config (consumed as-is — no fork), the active route is highlighted, and
 * the drawer opens/closes on mobile (`isOpen`/`closed` owned by the shell).
 * The footer Sign Out control signs out via the delivered `AuthService`
 * (no duplicate auth logic); the resulting `/login` navigation reproduces
 * the React observable behavior where the cleared identity re-renders
 * `ProtectedRoute` into `<Navigate to="/login" />`.
 */
@Component({
  selector: 'app-navigation',
  imports: [RouterLink],
  templateUrl: './navigation.html',
})
export class Navigation {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Mobile drawer state (shell-owned; desktop is always shown via `lg:`). */
  readonly isOpen = input(true);

  /** Close request from the mobile close button. */
  readonly closed = output<void>();

  protected readonly isLoading = this.auth.isLoading;
  protected readonly user = this.auth.user;

  /** Current path after redirects, query stripped (React `useLocation().pathname` parity). */
  protected readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => stripQuery(event.urlAfterRedirects)),
    ),
    { initialValue: stripQuery(this.router.url) },
  );

  /** Role-filtered items (W23 — consumed from `lib/navigation.ts`). */
  protected readonly accessibleItems = computed(() => {
    const user = this.user();
    return user ? getAccessibleNavItems(user.role) : [];
  });

  protected isActive(item: NavigationItem): boolean {
    return this.currentPath() === item.href;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // State is cleared unconditionally by AuthService (React parity:
      // the cleared identity drives the redirect regardless of API failure).
    }
    await this.router.navigateByUrl('/login');
  }
}

/** Strip the query string from a router URL (path-only comparison). */
function stripQuery(url: string): string {
  return url.split('?')[0] ?? url;
}
