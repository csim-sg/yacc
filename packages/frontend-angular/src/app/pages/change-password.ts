import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../lib/api-error-message';
import { AuthService } from '../services/auth.service';

/**
 * Change Password Page (React `pages/ChangePasswordPage.tsx` port — W1;
 * ADR-025 bootstrap/recovery path).
 *
 * The forced credential-replacement UI: an identity signed in with a
 * one-time initial credential MUST replace it here before anything else
 * is usable — the backend's ForcedPasswordChangeFilter denies every `/api`
 * path outside the auth endpoints until the credential is replaced
 * (MIG-030). Reached automatically after sign-in when
 * `mustChangePassword` is true.
 */
@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  templateUrl: './change-password.html',
})
export class ChangePassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected formError = signal<string | null>(null);
  protected isSubmitting = signal(false);

  protected async submit(): Promise<void> {
    this.formError.set(null);

    if (this.newPassword.length < 8) {
      this.formError.set('New password must be at least 8 characters long');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.formError.set('Passwords do not match');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.auth.changePassword({
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      });
      this.auth.markPasswordChanged();
      await this.router.navigateByUrl('/inbox');
    } catch (err: unknown) {
      this.formError.set(apiErrorMessage(err, 'Password change failed'));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
