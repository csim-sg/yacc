/**
 * Change Password Page (MIG-034; ADR-025 bootstrap/recovery path)
 *
 * The forced credential-replacement UI: the deterministic first-run Super
 * Admin (and any founder-recovery re-provisioned identity) signs in with a
 * one-time initial credential and MUST replace it here before anything
 * else is usable — the backend's ForcedPasswordChangeFilter denies every
 * `/api` path outside the auth endpoints until the credential is replaced
 * (MIG-030). Reached automatically after sign-in when
 * `mustChangePassword` is true.
 */

import { useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';

export function ChangePasswordPage(): ReactElement {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { markPasswordChanged } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      markPasswordChanged();
      navigate('/inbox');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-8">
            <h1 className="text-2xl font-bold text-base-content">Change Your Password</h1>
            <p className="text-base-content/70 text-sm mt-2" data-testid="forced-change-banner">
              For security you must replace your initial password before continuing.
            </p>

            {formError && (
              <div className="alert alert-error mt-6" role="alert">
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 mt-6">
              <div className="space-y-2">
                <label htmlFor="current-password" className="block text-sm font-medium text-base-content">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  className="input input-bordered w-full"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  data-testid="change-password-current"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-sm font-medium text-base-content">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="input input-bordered w-full"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                  data-testid="change-password-new"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-base-content">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="input input-bordered w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  data-testid="change-password-confirm"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                data-testid="change-password-submit"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
