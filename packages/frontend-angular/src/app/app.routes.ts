import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard';
import { ChangePassword } from './pages/change-password';
import { ForgotPassword } from './pages/forgot-password';
import { Login } from './pages/login';
import { OidcCallback } from './pages/oidc-callback';
import { Register } from './pages/register';
import { ResetPassword } from './pages/reset-password';

/**
 * Route table (ANG-004 — the auth/RBAC slice of the React `App.tsx`
 * route map; feature routes arrive with ANG-007..013).
 *
 * - Public auth forms sit behind `publicGuard` (authenticated users are
 *   redirected to `/inbox`, React `PublicRoute` parity).
 * - `/auth/callback` is the registered OIDC public-client redirect URI
 *   (MIG-033) — deliberately unguarded: it must complete regardless of
 *   prior state.
 * - `/change-password` serves the ADR-025 forced credential change and is
 *   `authGuard`-protected (an authenticated identity is required).
 */
export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [publicGuard] },
  { path: 'register', component: Register, canActivate: [publicGuard] },
  { path: 'forgot-password', component: ForgotPassword, canActivate: [publicGuard] },
  { path: 'reset-password', component: ResetPassword, canActivate: [publicGuard] },
  { path: 'auth/callback', component: OidcCallback },
  { path: 'change-password', component: ChangePassword, canActivate: [authGuard] },
];
