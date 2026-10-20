import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OidcService } from '../services/oidc.service';
import { AuthService } from '../services/auth.service';

/**
 * OIDC Callback Page (React `pages/OidcCallbackPage.tsx` port — MIG-034;
 * MIG-033 embedded AS).
 *
 * Lands at the registered public-client redirect URI (`{origin}/auth/callback`)
 * carrying the authorization `code` + `state`. Validates `state`, exchanges
 * the code with the PKCE verifier, adopts the AS token pair as the SPA
 * session, and continues into the inbox (or the forced credential change
 * for a bootstrap/recovery identity). Runs the exchange exactly once per
 * landing.
 */
@Component({
  selector: 'app-oidc-callback',
  imports: [RouterLink],
  templateUrl: './oidc-callback.html',
})
export class OidcCallback {
  private readonly auth = inject(AuthService);
  private readonly oidc = inject(OidcService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);

  constructor() {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    if (!code || !state) {
      this.error.set('Missing authorization code');
      return;
    }
    void this.complete(code, state);
  }

  private async complete(code: string, state: string): Promise<void> {
    try {
      await this.oidc.completeLogin(code, state);
      // Resolve the identity and the forced-password-change state with the
      // new AS-issued access token, then sync the auth state.
      await this.auth.loadSession();
      if (!this.auth.isAuthenticated()) {
        await this.router.navigateByUrl('/login');
      } else if (this.auth.mustChangePassword()) {
        await this.router.navigateByUrl('/change-password');
      } else {
        await this.router.navigateByUrl('/inbox');
      }
    } catch {
      this.error.set('Sign-in could not be completed');
    }
  }
}
