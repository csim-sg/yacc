import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';

import { logger } from '../../lib/logger';
import { AuthService } from '../../services/auth.service';
import { OidcService } from '../../services/oidc.service';
import { TokenStorageService } from '../../services/token-storage.service';
import { NotificationCenter } from '../notification-center/notification-center';

/**
 * Header (React `Header.tsx` port — W2/W17).
 *
 * Top bar: brand, mobile menu toggle, the `NotificationCenter` mount
 * (once — the shell places it on every authenticated route), the session
 * user info (name/role/avatar), the OIDC session button (embedded AS
 * login via the delivered `OidcService`), and logout with its
 * confirmation modal (via the delivered `AuthService`). No duplicate
 * auth logic — every control delegates to the delivered services.
 */
@Component({
  selector: 'app-header',
  imports: [NotificationCenter],
  templateUrl: './header.html',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly oidc = inject(OidcService);
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);

  /** Mobile menu toggle request (shell-owned drawer state). */
  readonly menuClick = output<void>();

  protected readonly user = this.auth.user;
  protected readonly isLoading = this.auth.isLoading;

  protected readonly showLogoutConfirm = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly isOidcStarting = signal(false);

  /** Open the logout confirmation modal (React `handleLogout` parity). */
  protected requestLogout(): void {
    this.showLogoutConfirm.set(true);
  }

  protected cancelLogout(): void {
    this.showLogoutConfirm.set(false);
  }

  /**
   * Confirm logout: sign out through `AuthService` (which always clears
   * the local state) and hand over to `/login`. On failure the modal
   * stays interactable (React parity: error logged, spinner reset).
   */
  protected async confirmLogout(): Promise<void> {
    this.isLoggingOut.set(true);
    try {
      await this.auth.signOut();
      this.showLogoutConfirm.set(false);
      await this.router.navigateByUrl('/login');
    } catch (error: unknown) {
      logger.error('[Header] Logout failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isLoggingOut.set(false);
    }
  }

  /**
   * Start the OIDC authorization-code + PKCE flow against the embedded
   * authorization server (MIG-033; ADR-025). Requires the current local
   * access token — no token, no-op (React parity).
   */
  protected async startOidcLogin(): Promise<void> {
    const accessToken = this.tokens.getAccessToken();
    if (!accessToken) {
      return;
    }
    this.isOidcStarting.set(true);
    try {
      await this.oidc.beginLogin(accessToken);
    } catch (error: unknown) {
      logger.error('[Header] OIDC login failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isOidcStarting.set(false);
    }
  }

  /** Role label with underscores replaced by spaces (React parity). */
  protected roleLabel(): string {
    return this.user()?.role.replace(/_/g, ' ') ?? '';
  }

  /** Avatar initial — first character of the name or email, uppercased. */
  protected avatarInitial(): string {
    const user = this.user();
    const source = user ? user.name || user.email : '';
    return source.length > 0 ? source[0].toUpperCase() : '';
  }
}
