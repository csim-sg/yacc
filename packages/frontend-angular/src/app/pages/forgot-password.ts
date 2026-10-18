import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Submission lifecycle of the recovery form (React parity). */
type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Forgot Password Page (React `pages/ForgotPasswordPage.tsx` port — W4).
 *
 * Requests a password reset. The frozen endpoint answers a constant
 * anti-enumeration message; on any failure the UI shows the same generic
 * message (no account enumeration). Redirects to login after success.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected state = signal<SubmissionState>('idle');
  protected error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.error.set(null);

    // Client-side validation
    if (!this.email || !this.email.includes('@')) {
      this.error.set('Please enter a valid email address');
      return;
    }

    this.state.set('loading');

    try {
      await this.auth.forgotPassword({ email: this.email });
      this.state.set('success');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        void this.router.navigateByUrl('/login');
      }, 3000);
    } catch {
      // P0: Always show generic message to prevent enumeration
      this.error.set('If an account with this email exists, you will receive a password reset link');
      this.state.set('error');
    }
  }
}
