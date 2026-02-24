/**
 * Unit Tests for UsersTable Component
 *
 * Tests cover:
 * - Table rendering and columns
 * - Sorting functionality
 * - Filtering functionality
 * - Pagination
 * - Create/Edit/Delete modals
 * - RBAC enforcement
 * - Self-modification prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsersTable } from '../UsersTable';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useRoles } from '../../../hooks/useUsers';
import type { UserDTO, ListUsersResponse, ListRolesResponse } from '../../../types/user.types';

// Mock the hooks
vi.mock('../../../hooks/useUsers');
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
    },
  }),
}));

const mockedUseUsers = vi.mocked(useUsers);
const mockedUseCreateUser = vi.mocked(useCreateUser);
const mockedUseUpdateUser = vi.mocked(useUpdateUser);
const mockedUseDeleteUser = vi.mocked(useDeleteUser);
const mockedUseRoles = vi.mocked(useRoles);

// Sample data
const mockUsers: UserDTO[] = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'super_admin',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'user-2',
    email: 'manager@example.com',
    name: 'Manager User',
    role: 'manager',
    status: 'active',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'user-3',
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user',
    status: 'inactive',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

const mockRoles: ListRolesResponse = {
  roles: [
    { id: 'super_admin', label: 'Super Admin', description: 'Full access', permissions: [] },
    { id: 'admin', label: 'Admin', description: 'Admin access', permissions: [] },
    { id: 'manager', label: 'Manager', description: 'Manager access', permissions: [] },
    { id: 'user', label: 'User', description: 'User access', permissions: [] },
  ],
};

// Helper to create wrapper with query client
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('UsersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockedUseUsers.mockReturnValue({
      data: {
        users: mockUsers,
        pagination: { total: 3, page: 1, limit: 20, totalPages: 1 },
      } as ListUsersResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useUsers>);

    mockedUseRoles.mockReturnValue({
      data: mockRoles,
      isLoading: false,
    } as unknown as ReturnType<typeof useRoles>);

    mockedUseCreateUser.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUser>);

    mockedUseUpdateUser.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateUser>);

    mockedUseDeleteUser.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteUser>);
  });

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('Rendering', () => {
    it('should render table with users', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('users-table')).toBeInTheDocument();
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      expect(screen.getByText('manager@example.com')).toBeInTheDocument();
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    it('should show create user button', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('create-user-btn')).toBeInTheDocument();
    });

    it('should show search input', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('should show role filter', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('role-filter')).toBeInTheDocument();
    });

    it('should show status filter', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    it('should show total user count', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByText(/Showing 1-3 of 3 users/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Loading/Error States
  // ========================================================================

  describe('States', () => {
    it('should show loading state', () => {
      mockedUseUsers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown as ReturnType<typeof useUsers>);

      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('should show error state', () => {
      mockedUseUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
      } as unknown as ReturnType<typeof useUsers>);

      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('error-alert')).toBeInTheDocument();
    });

    it('should show empty state when no users', () => {
      mockedUseUsers.mockReturnValue({
        data: {
          users: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useUsers>);

      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Sorting Tests
  // ========================================================================

  describe('Sorting', () => {
    it('should sort by email when header clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('sort-email'));

      // Check sort indicator
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should toggle sort direction when same header clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('sort-email'));
      expect(screen.getByText('↑')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('sort-email'));
      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('should sort by role when header clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('sort-role'));

      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should sort by status when header clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('sort-status'));

      expect(screen.getByText('↑')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Filtering Tests
  // ========================================================================

  describe('Filtering', () => {
    it('should show clear filters button when filters active', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      // Apply role filter
      fireEvent.change(screen.getByTestId('role-filter'), { target: { value: 'admin' } });

      await waitFor(() => {
        expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument();
      });
    });

    it('should clear all filters when clear button clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      // Apply role filter
      fireEvent.change(screen.getByTestId('role-filter'), { target: { value: 'admin' } });

      await waitFor(() => {
        expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument();
      });

      // Clear filters
      fireEvent.click(screen.getByTestId('clear-filters-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('role-filter')).toHaveValue('');
      });
    });
  });

  // ========================================================================
  // Pagination Tests
  // ========================================================================

  describe('Pagination', () => {
    it('should show page size selector', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('page-size-select')).toBeInTheDocument();
    });

    it('should show pagination controls', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      expect(screen.getByTestId('prev-page-btn')).toBeInTheDocument();
      expect(screen.getByTestId('next-page-btn')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Create User Modal Tests
  // ========================================================================

  describe('Create User Modal', () => {
    it('should open create modal when create button clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('create-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
      });
    });

    it('should close modal when cancel clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('create-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
      });

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('create-user-modal')).not.toBeInTheDocument();
      });
    });

    it('should have required form fields', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('create-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-email-input')).toBeInTheDocument();
        expect(screen.getByTestId('create-name-input')).toBeInTheDocument();
        expect(screen.getByTestId('create-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('create-role-select')).toBeInTheDocument();
      });
    });

    it('should disable submit button when form invalid', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('create-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-submit-btn')).toBeDisabled();
      });
    });
  });

  // ========================================================================
  // Edit User Modal Tests
  // ========================================================================

  describe('Edit User Modal', () => {
    it('should open edit modal when edit button clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
      });
    });

    it('should show user email in modal title', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByText(/Edit User: manager@example.com/)).toBeInTheDocument();
      });
    });

    it('should have form fields for editing', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-name-input')).toBeInTheDocument();
        expect(screen.getByTestId('edit-role-select')).toBeInTheDocument();
        expect(screen.getByTestId('edit-status-select')).toBeInTheDocument();
      });
    });

    it('should disable submit when no changes', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-submit-btn')).toBeDisabled();
      });
    });
  });

  // ========================================================================
  // Delete User Modal Tests
  // ========================================================================

  describe('Delete User Modal', () => {
    it('should open delete modal when delete button clicked', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('delete-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-user-modal')).toBeInTheDocument();
      });
    });

    it('should show confirmation message', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('delete-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
      });
    });

    it('should have delete and cancel buttons', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('delete-btn-user-2'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-confirm-btn')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // Self-Modification Prevention Tests
  // ========================================================================

  describe('Self-Modification Prevention', () => {
    it('should disable delete button for current user', () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      // Current user is 'user-1' (admin@example.com)
      expect(screen.getByTestId('delete-btn-user-1')).toBeDisabled();
    });

    it('should show warning when editing self', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-1'));

      await waitFor(() => {
        expect(screen.getByText(/You cannot modify your own role or status/)).toBeInTheDocument();
      });
    });

    it('should disable role/status fields when editing self', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('edit-btn-user-1'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-role-select')).toBeDisabled();
        expect(screen.getByTestId('edit-status-select')).toBeDisabled();
      });
    });

    it('should not open delete modal for current user since button is disabled', async () => {
      render(<UsersTable />, { wrapper: createWrapper() });

      // Try to click the disabled delete button
      fireEvent.click(screen.getByTestId('delete-btn-user-1'));

      // Modal should NOT open because button is disabled
      await waitFor(() => {
        expect(screen.queryByTestId('delete-user-modal')).not.toBeInTheDocument();
      });
    });
  });
});
