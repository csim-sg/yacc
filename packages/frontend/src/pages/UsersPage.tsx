/**
 * Users Page
 *
 * Admin page for managing users with the UsersTable component.
 * Only accessible to Super Admin users (RBAC enforced in component).
 */

import { UsersTable } from '../components/admin/UsersTable';

export function UsersPage(): JSX.Element {
  return <UsersTable />;
}
