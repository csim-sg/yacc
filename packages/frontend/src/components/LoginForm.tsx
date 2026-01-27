/**
 * Login Form Component
 *
 * Handles login form rendering with:
 * - Email and password inputs
 * - Client-side form validation
 * - Server-side error display
 * - Loading states
 * - Password visibility toggle
 * - Form accessibility (WCAG 2.1 AA)
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

/**
 * Form validation errors
 */
interface FormErrors {
  email?: string;
  password?: string;
}

/**
 * Login Form Props
 */
interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClearError: () => void;
}

/**
 * Validate email format (RFC 5322 simplified)
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate form inputs
 */
function validateForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  return errors;
}

/**
 * Login Form Component
 */
export function LoginForm({
  email,
  password,
  isLoading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onClearError,
}: LoginFormProps): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });

  /**
   * Validate on blur
   */
  const handleEmailBlur = (): void => {
    setTouched((prev) => ({ ...prev, email: true }));
    if (email) {
      const errors = validateForm(email, password);
      setFormErrors((prev) => ({ ...prev, email: errors.email }));
    }
  };

  const handlePasswordBlur = (): void => {
    setTouched((prev) => ({ ...prev, password: true }));
    if (password) {
      const errors = validateForm(email, password);
      setFormErrors((prev) => ({ ...prev, password: errors.password }));
    }
  };

  /**
   * Validate on change
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newEmail = e.target.value;
    onEmailChange(newEmail);

    if (touched.email) {
      const errors = validateForm(newEmail, password);
      setFormErrors((prev) => ({ ...prev, email: errors.email }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newPassword = e.target.value;
    onPasswordChange(newPassword);

    if (touched.password) {
      const errors = validateForm(email, newPassword);
      setFormErrors((prev) => ({ ...prev, password: errors.password }));
    }
  };

  /**
   * Form submit with validation
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Validate
    const errors = validateForm(email, password);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Submit
    await onSubmit(e);
  };

  const isFormValid = !formErrors.email && !formErrors.password && email && password;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-base-content">Welcome Back!</h1>
          <p className="text-base-content/70 text-sm mt-2">
            Sign in to continue your omni-channel experience
          </p>
        </div>

        {/* Server Error Alert */}
        {error && (
          <div className="alert alert-error mb-6" role="alert">
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
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClearError}
              aria-label="Close error message"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-base-content">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              className={`input input-bordered w-full ${
                touched.email && formErrors.email ? 'input-error' : ''
              }`}
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              disabled={isLoading}
              aria-invalid={touched.email && !!formErrors.email}
              aria-describedby={touched.email && formErrors.email ? 'email-error' : undefined}
              required
            />
            {touched.email && formErrors.email && (
              <p id="email-error" className="text-error text-sm" role="alert">
                {formErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-base-content">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`input input-bordered w-full pr-10 ${
                  touched.password && formErrors.password ? 'input-error' : ''
                }`}
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                disabled={isLoading}
                aria-invalid={touched.password && !!formErrors.password}
                aria-describedby={touched.password && formErrors.password ? 'password-error' : undefined}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {touched.password && formErrors.password && (
              <p id="password-error" className="text-error text-sm" role="alert">
                {formErrors.password}
              </p>
            )}

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm link link-hover text-primary">
                Forgot Password?
              </Link>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading || !isFormValid}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center mt-8">
          <p className="text-sm text-base-content/70">
            Don't have an account?{' '}
            <Link to="/register" className="link link-primary font-medium">
              Create One
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
