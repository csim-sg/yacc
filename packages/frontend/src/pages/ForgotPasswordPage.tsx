/**
 * Forgot Password Page Component
 *
 * Renders the forgot password form with:
 * - Email input for account recovery
 * - Client-side form validation
 * - Server-side error handling
 * - Loading states
 * - Success confirmation message
 * - Mobile responsive design
 * - WCAG 2.1 AA accessibility
 *
 * Features (P0):
 * - No account enumeration (always returns 200)
 * - Email validation
 * - Link back to login
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { logger } from '../lib/logger';

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setState('loading');

    try {
      await api.post('/api/auth/forgot-password', { email });
      
      logger.info('[ForgotPasswordPage] Forgot password request sent', { email });
      setState('success');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process request';
      logger.error('[ForgotPasswordPage] Forgot password request failed', { email, error: message });
      
      // P0: Always show generic message to prevent enumeration
      setError('If an account with this email exists, you will receive a password reset link');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-content font-bold text-xl">Y</span>
              </div>
              <span className="text-xl font-bold">YACC</span>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-8">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-base-content">Forgot Password?</h1>
                <p className="text-base-content/70 text-sm mt-2">
                  No worries! We'll send you instructions to reset your password.
                </p>
              </div>

              {state === 'success' ? (
                <div className="alert alert-success">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Check your email for the reset link. Redirecting to login...</span>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="alert alert-info mb-6">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-medium text-base-content">
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="input input-bordered w-full"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={state === 'loading'}
                        required
                        autoComplete="email"
                        data-testid="forgot-password-email"
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-full"
                      disabled={state === 'loading' || !email}
                      data-testid="forgot-password-submit"
                    >
                      {state === 'loading' ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-base-content/70">
                  Remember your password?{' '}
                  <Link to="/login" className="link link-primary">
                    Back to login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
