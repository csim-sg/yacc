/**
 * OIDC Callback Page (MIG-034; MIG-033 embedded AS)
 *
 * Lands at the registered public-client redirect URI
 * (`{origin}/auth/callback`) carrying the authorization `code` + `state`.
 * Validates `state`, exchanges the code with the PKCE verifier, adopts the
 * AS token pair as the SPA session, and continues into the inbox (or the
 * forced credential change for a bootstrap/recovery identity).
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { completeOidcLogin } from '../services/oidc.service';

export function OidcCallbackPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { refreshSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      setError('Missing authorization code');
      return;
    }

    void (async (): Promise<void> => {
      try {
        await completeOidcLogin(code, state);
        // Resolve the identity and the forced-password-change state with
        // the new AS-issued access token, then sync the auth context.
        const session = await authService.getSession();
        await refreshSession();
        if (!session) {
          navigate('/login');
        } else if (session.mustChangePassword) {
          navigate('/change-password');
        } else {
          navigate('/inbox');
        }
      } catch {
        setError('Sign-in could not be completed');
      }
    })();
    // Run once per callback landing (empty deps: searchParams is stable
    // for the mounted URL and the exchange must happen exactly once).
  }, []);

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-8">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body items-center text-center p-8">
          {error ? (
            <>
              <h1 className="text-xl font-bold text-base-content">Sign-in Failed</h1>
              <div className="alert alert-error mt-4" role="alert" data-testid="oidc-callback-error">
                <span>{error}</span>
              </div>
              <Link to="/login" className="btn btn-primary mt-6">
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-base-content/70">Completing sign-in...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
