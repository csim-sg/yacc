import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Login Page (React `pages/LoginPage.tsx` port — W1).
 *
 * Renders the login form with email/password inputs, server-side error
 * surfacing, loading states, forgot-password and registration links.
 * Bootstrap/recovery identities (ADR-025 `mustChangePassword`) are routed
 * to `/change-password` after sign-in.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected showPassword = false;

  protected async submit(): Promise<void> {
    this.auth.clearError();
    try {
      const mustChangePassword = await this.auth.signIn({
        email: this.email,
        password: this.password,
      });
      // Bootstrap/recovery identities must replace their one-time
      // credential before anything else is usable (ADR-025).
      await this.router.navigateByUrl(mustChangePassword ? '/change-password' : '/inbox');
    } catch {
      // Error is surfaced via `auth.error()` and displayed in the form.
    }
  }
}
