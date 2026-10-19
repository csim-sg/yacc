import { Routes } from '@angular/router';

import { AppShell } from './components/app-shell/app-shell';
import { Inbox } from './pages/inbox/inbox';
import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard';
import { ChangePassword } from './pages/change-password';
import { ForgotPassword } from './pages/forgot-password';
import { Login } from './pages/login';
import { OidcCallback } from './pages/oidc-callback';
import { Register } from './pages/register';
import { ResetPassword } from './pages/reset-password';

/**
 * Route table (React `App.tsx` route map port — W2/W5/W23; the shell
 * slice ANG-007).
 *
 * - Public auth forms sit behind `publicGuard` (authenticated users are
 *   redirected to `/inbox`, React `PublicRoute` parity) and render NO
 *   shell.
 * - `/auth/callback` is the registered OIDC public-client redirect URI
 *   (MIG-033) — deliberately unguarded: it must complete regardless of
 *   prior state.
 * - `/change-password` serves the ADR-025 forced credential change and is
 *   `authGuard`-protected (an authenticated identity is required).
 * - The empty-path group is the shared authenticated shell
 *   (`AppShell` = `Navigation` + `Header` + `NotificationCenter` mount)
 *   wrapping the authenticated feature routes behind `authGuard`
 *   (React `ProtectedRoute` → `MainLayout` parity). Feature issues
 *   (ANG-008, ANG-010..013) append their own rows as its children —
 *   ANG-007 is the sole writer of this group.
 * - The catch-all redirects to `/inbox` (React `path="*"` parity); for
 *   unauthenticated visitors the shell guard then redirects to `/login`.
 */
export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [publicGuard] },
  { path: 'register', component: Register, canActivate: [publicGuard] },
  { path: 'forgot-password', component: ForgotPassword, canActivate: [publicGuard] },
  { path: 'reset-password', component: ResetPassword, canActivate: [publicGuard] },
  { path: 'auth/callback', component: OidcCallback },
  { path: 'change-password', component: ChangePassword, canActivate: [authGuard] },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: 'inbox', component: Inbox },
      { path: '', pathMatch: 'full', redirectTo: 'inbox' },
    ],
  },
  { path: '**', redirectTo: 'inbox' },
];
