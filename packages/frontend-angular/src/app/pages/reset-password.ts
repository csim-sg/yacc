import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../lib/api-error-message';
import { AuthService } from '../services/auth.service';

/** Submission lifecycle of the reset form (React parity). */
type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

/** Classified reset failure (drives the surfaced message). */
interface ResetPasswordError {
  code: 'invalid-token' | 'expired-token' | 'mismatch' | 'weak-password' | 'unknown';
  message: string;
}

/**
 * Reset Password Page (React `pages/ResetPasswordPage.tsx` port — W4).
 *
 * Sets a new password with the emailed token (single-use). Token absence
 * fails closed before any form renders; success redirects to login with
 * no auto-login (P0 parity).
 */
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected password = '';
  protected confirmPassword = '';
  protected showPassword = false;
  protected state = signal<SubmissionState>('idle');
  protected error = signal<ResetPasswordError | null>(null);
  protected readonly tokenValid = signal(true);
  private token = '';

  constructor() {
    // Extract the token from the URL query parameter (fail closed).
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (!tokenParam) {
      this.tokenValid.set(false);
      this.error.set({
        code: 'invalid-token',
        message: 'Reset link is missing or invalid. Please request a new one.',
      });
      return;
    }
    this.token = tokenParam;
  }

  protected async submit(): Promise<void> {
    this.error.set(null);

    // Client-side validation
    if (!this.password || !this.confirmPassword) {
      this.error.set({ code: 'weak-password', message: 'Please fill in all fields' });
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set({ code: 'mismatch', message: 'Passwords do not match' });
      return;
    }

    if (this.password.length < 8) {
      this.error.set({
        code: 'weak-password',
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    this.state.set('loading');

    try {
      await this.auth.resetPassword({ token: this.token, password: this.password });
      this.state.set('success');

      // P0: Redirect to login (no auto-login)
      setTimeout(() => {
        void this.router.navigateByUrl('/login');
      }, 2000);
    } catch (err: unknown) {
      // Parse the backend error to determine the error type
      const raw = apiErrorMessage(err, 'Failed to reset password');
      let classified: ResetPasswordError = {
        code: 'unknown',
        message: 'Failed to reset password. Please try again.',
      };

      if (raw.includes('invalid') || raw.includes('not found')) {
        classified = { code: 'invalid-token', message: 'Reset link is invalid. Please request a new one.' };
      } else if (raw.includes('expired')) {
        classified = { code: 'expired-token', message: 'Reset link has expired. Please request a new one.' };
      }

      this.error.set(classified);
      this.state.set('error');
    }
  }
}
