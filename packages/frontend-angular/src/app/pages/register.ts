import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Register Page (React `pages/registerPage.tsx` port — W3).
 *
 * Self-registration form (creates `role: user` only — no role field).
 * Client-side match/length validation precedes the wire call; on success
 * the user is handed to the login page (no auto-login, POC parity).
 */
@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected name = '';
  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  protected showPassword = false;
  protected localError = '';

  /** Client-side error takes precedence over the surfaced auth error. */
  protected get displayError(): string {
    return this.localError || this.auth.error() || '';
  }

  protected async submit(): Promise<void> {
    this.auth.clearError();
    this.localError = '';

    if (this.password !== this.confirmPassword) {
      this.localError = 'Passwords do not match';
      return;
    }

    if (this.password.length < 6) {
      this.localError = 'Password must be at least 6 characters';
      return;
    }

    try {
      await this.auth.register({ email: this.email, password: this.password, name: this.name });
      await this.router.navigateByUrl('/login');
    } catch {
      // Error is surfaced via `auth.error()` / `displayError`.
    }
  }
}
