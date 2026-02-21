/**
 * Users Table Component
 *
 * Admin panel table for managing users with:
 * - Sorting by email, role, status, createdAt
 * - Filtering by role, status, search
 * - Pagination (20/50/100 per page)
 * - Create, Edit, Delete modals
 * - RBAC enforcement (Super Admin only)
 *
 * @module @yacc/frontend/components/admin
 */

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useRoles,
} from '../../hooks/useUsers';
import type {
  UserDTO,
  UserFilters,
  UserRole,
  UserStatus,
  CreateUserDTO,
  UpdateUserDTO,
} from '../../types/user.types';

/**
 * Sort direction type
 */
type SortDirection = 'asc' | 'desc';

/**
 * Sort field type
 */
type SortField = 'email' | 'role' | 'status' | 'createdAt';

/**
 * Users Table Props
 */
export interface UsersTableProps {
  className?: string;
}

/**
 * Users Table Component
 */
export function UsersTable({ className = '' }: UsersTableProps): JSX.Element {
  const { user: currentUser } = useAuth();

  // State for filters, pagination, and sorting
  const [filters, setFilters] = useState<UserFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserDTO | null>(null);

  // Search debounce state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>();

  // Queries and mutations
  const { data, isLoading, error, refetch } = useUsers(
    { ...filters, search: debouncedSearch },
    { page, limit: pageSize }
  );
  const { data: rolesData } = useRoles();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  // RBAC check - only Super Admin can manage users
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Handle search input change with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    // Debounce search
    setTimeout(() => {
      setDebouncedSearch(value || undefined);
      setPage(1); // Reset to first page on search
    }, 300);
  }, []);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof UserFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1); // Reset to first page on filter change
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchInput('');
    setDebouncedSearch(undefined);
    setPage(1);
  }, []);

  // Handle create user
  const handleCreateUser = useCallback(async (data: CreateUserDTO) => {
    await createMutation.mutateAsync(data);
    setShowCreateModal(false);
  }, [createMutation]);

  // Handle update user
  const handleUpdateUser = useCallback(async (id: string, data: UpdateUserDTO) => {
    await updateMutation.mutateAsync({ id, data });
    setEditingUser(null);
  }, [updateMutation]);

  // Handle delete user
  const handleDeleteUser = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeletingUser(null);
  }, [deleteMutation]);

  // Check if editing/deleting self
  const isEditingSelf = editingUser?.id === currentUser?.id;
  const isDeletingSelf = deletingUser?.id === currentUser?.id;

  // Sort users client-side (backend doesn't support sort yet)
  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data?.users, sortField, sortDirection]);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some((v) => v) || debouncedSearch;

  // RBAC: Non-Super Admin sees permission message
  if (!isSuperAdmin) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="alert alert-warning max-w-md mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>You do not have permission to manage users</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-base-content/70 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          data-testid="create-user-btn"
        >
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="form-control">
          <input
            type="text"
            placeholder="Search by email..."
            className="input input-bordered w-64"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="search-input"
          />
        </div>

        {/* Role Filter */}
        <select
          className="select select-bordered"
          value={filters.role || ''}
          onChange={(e) => handleFilterChange('role', e.target.value || undefined)}
          data-testid="role-filter"
        >
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>

        {/* Status Filter */}
        <select
          className="select select-bordered"
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
          data-testid="status-filter"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearFilters}
            data-testid="clear-filters-btn"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="alert alert-error mb-6" data-testid="error-alert">
          <span>Failed to load users</span>
          <button className="btn btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12" data-testid="loading-state">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedUsers.length === 0 && (
        <div className="alert alert-info" data-testid="empty-state">
          <span>No users found</span>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && sortedUsers.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra" data-testid="users-table">
              <thead>
                <tr>
                  <th
                    className="cursor-pointer hover:bg-base-200"
                    onClick={() => handleSort('email')}
                    data-testid="sort-email"
                  >
                    Email
                    {sortField === 'email' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="cursor-pointer hover:bg-base-200"
                    onClick={() => handleSort('role')}
                    data-testid="sort-role"
                  >
                    Role
                    {sortField === 'role' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="cursor-pointer hover:bg-base-200"
                    onClick={() => handleSort('status')}
                    data-testid="sort-status"
                  >
                    Status
                    {sortField === 'status' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="cursor-pointer hover:bg-base-200"
                    onClick={() => handleSort('createdAt')}
                    data-testid="sort-created"
                  >
                    Created
                    {sortField === 'createdAt' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id} data-testid={`user-row-${user.id}`}>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${
                        user.role === 'super_admin' ? 'badge-primary' :
                        user.role === 'admin' ? 'badge-secondary' :
                        user.role === 'manager' ? 'badge-accent' :
                        'badge-ghost'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        user.status === 'active' ? 'badge-success' :
                        user.status === 'inactive' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setEditingUser(user)}
                          data-testid={`edit-btn-${user.id}`}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline btn-error"
                          onClick={() => setDeletingUser(user)}
                          disabled={user.id === currentUser?.id}
                          title={user.id === currentUser?.id ? 'Cannot delete your own account' : ''}
                          data-testid={`delete-btn-${user.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/70">
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data?.pagination.total || 0)} of {data?.pagination.total || 0} users
            </div>
            <div className="flex gap-2 items-center">
              <select
                className="select select-bordered select-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as 20 | 50 | 100);
                  setPage(1);
                }}
                data-testid="page-size-select"
              >
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <div className="btn-group">
                <button
                  className="btn btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  data-testid="prev-page-btn"
                >
                  «
                </button>
                <button className="btn btn-sm">Page {page}</button>
                <button
                  className="btn btn-sm"
                  disabled={page >= (data?.pagination.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  data-testid="next-page-btn"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          roles={rolesData?.roles || []}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={rolesData?.roles || []}
          isEditingSelf={isEditingSelf}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) => handleUpdateUser(editingUser.id, data)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <DeleteUserConfirmation
          user={deletingUser}
          isDeletingSelf={isDeletingSelf}
          onClose={() => setDeletingUser(null)}
          onConfirm={() => handleDeleteUser(deletingUser.id)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

/**
 * Create User Modal Component
 */
interface CreateUserModalProps {
  roles: Array<{ id: UserRole; label: string }>;
  onClose: () => void;
  onSubmit: (data: CreateUserDTO) => Promise<void>;
  isLoading: boolean;
}

function CreateUserModal({ roles, onClose, onSubmit, isLoading }: CreateUserModalProps): JSX.Element {
  const [formData, setFormData] = useState<CreateUserDTO>({
    email: '',
    password: '',
    name: '',
    role: 'user',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const isValid = formData.email && formData.password && formData.name && formData.role;

  return (
    <dialog className="modal modal-open" data-testid="create-user-modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create New User</h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Email *</span>
            </label>
            <input
              type="email"
              className="input input-bordered"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              data-testid="create-email-input"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="create-name-input"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Password *</span>
            </label>
            <input
              type="password"
              className="input input-bordered"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              data-testid="create-password-input"
            />
            <label className="label">
              <span className="label-text-alt">Minimum 8 characters</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Role *</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              data-testid="create-role-select"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || isLoading}
              data-testid="create-submit-btn"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
}

/**
 * Edit User Modal Component
 */
interface EditUserModalProps {
  user: UserDTO;
  roles: Array<{ id: UserRole; label: string }>;
  isEditingSelf: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateUserDTO) => Promise<void>;
  isLoading: boolean;
}

function EditUserModal({
  user,
  roles,
  isEditingSelf,
  onClose,
  onSubmit,
  isLoading,
}: EditUserModalProps): JSX.Element {
  const [formData, setFormData] = useState<UpdateUserDTO>({
    name: user.name,
    role: user.role,
    status: user.status,
  });
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    formData.name !== user.name ||
    formData.role !== user.role ||
    formData.status !== user.status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  return (
    <dialog className="modal modal-open" data-testid="edit-user-modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Edit User: {user.email}</h3>

        {isEditingSelf && (
          <div className="alert alert-warning mb-4">
            <span>You cannot modify your own role or status</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="edit-name-input"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Role</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              disabled={isEditingSelf}
              data-testid="edit-role-select"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Status</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.status || ''}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
              disabled={isEditingSelf}
              data-testid="edit-status-select"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasChanges || isLoading}
              data-testid="edit-submit-btn"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Updating...
                </>
              ) : (
                'Update User'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
}

/**
 * Delete User Confirmation Modal
 */
interface DeleteUserConfirmationProps {
  user: UserDTO;
  isDeletingSelf: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function DeleteUserConfirmation({
  user,
  isDeletingSelf,
  onClose,
  onConfirm,
  isLoading,
}: DeleteUserConfirmationProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <dialog className="modal modal-open" data-testid="delete-user-modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Delete User</h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <p className="mb-4">
          Are you sure you want to delete <strong>{user.email}</strong>? This cannot be undone.
        </p>

        {isDeletingSelf && (
          <div className="alert alert-warning mb-4">
            <span>You cannot delete your own account</span>
          </div>
        )}

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleConfirm}
            disabled={isDeletingSelf || isLoading}
            data-testid="delete-confirm-btn"
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
}
