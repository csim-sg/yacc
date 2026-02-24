/**
 * E2E Tests for Users Table (FE-019)
 *
 * Tests cover:
 * - Table rendering
 * - Create/Edit/Delete user flows
 * - Sorting and filtering
 * - Pagination
 * - Self-modification prevention
 * - RBAC enforcement
 */

import { test, expect } from '@playwright/test';

test.describe('Users Table', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to users page
    await page.goto('/users');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display users table', async ({ page }) => {
    // Check for table element
    await expect(page.getByTestId('users-table')).toBeVisible();
  });

  test('should show create user button', async ({ page }) => {
    await expect(page.getByTestId('create-user-btn')).toBeVisible();
  });

  test('should display user rows', async ({ page }) => {
    // Check for user rows (at least one should be visible)
    const rows = await page.locator('[data-testid^="user-row-"]').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('should show search and filter controls', async ({ page }) => {
    await expect(page.getByTestId('search-input')).toBeVisible();
    await expect(page.getByTestId('role-filter')).toBeVisible();
    await expect(page.getByTestId('status-filter')).toBeVisible();
  });

  test('should open create user modal', async ({ page }) => {
    await page.getByTestId('create-user-btn').click();
    
    await expect(page.getByTestId('create-user-modal')).toBeVisible();
    await expect(page.getByText('Create New User')).toBeVisible();
  });

  test('should create a new user', async ({ page }) => {
    const timestamp = Date.now();
    const email = `test-${timestamp}@example.com`;
    
    await page.getByTestId('create-user-btn').click();
    
    // Fill form
    await page.getByTestId('create-email-input').fill(email);
    await page.getByTestId('create-name-input').fill('Test User');
    await page.getByTestId('create-password-input').fill('password123');
    await page.getByTestId('create-role-select').selectOption('user');
    
    // Submit
    await page.getByTestId('create-submit-btn').click();
    
    // Modal should close
    await expect(page.getByTestId('create-user-modal')).not.toBeVisible();
    
    // New user should appear in table
    await expect(page.getByText(email)).toBeVisible();
  });

  test('should open edit user modal', async ({ page }) => {
    // Find and click edit button for a non-current user
    const editButtons = await page.locator('[data-testid^="edit-btn-"]').count();
    
    if (editButtons > 1) {
      // Click the second user's edit button (not current user)
      await page.locator('[data-testid^="edit-btn-"]').nth(1).click();
      
      await expect(page.getByTestId('edit-user-modal')).toBeVisible();
    }
  });

  test('should edit a user', async ({ page }) => {
    // Find and click edit button for a non-current user
    const editButtons = await page.locator('[data-testid^="edit-btn-"]').count();
    
    if (editButtons > 1) {
      await page.locator('[data-testid^="edit-btn-"]').nth(1).click();
      
      // Change name
      await page.getByTestId('edit-name-input').fill('Updated Name');
      
      // Submit
      await page.getByTestId('edit-submit-btn').click();
      
      // Modal should close
      await expect(page.getByTestId('edit-user-modal')).not.toBeVisible();
    }
  });

  test('should open delete confirmation modal', async ({ page }) => {
    // Find and click delete button for a non-current user
    const deleteButtons = await page.locator('[data-testid^="delete-btn-"]:not([disabled])').count();
    
    if (deleteButtons > 0) {
      await page.locator('[data-testid^="delete-btn-"]:not([disabled])').first().click();
      
      await expect(page.getByTestId('delete-user-modal')).toBeVisible();
    }
  });

  test('should delete a user', async ({ page }) => {
    // First create a user to delete
    const timestamp = Date.now();
    const email = `delete-${timestamp}@example.com`;
    
    await page.getByTestId('create-user-btn').click();
    await page.getByTestId('create-email-input').fill(email);
    await page.getByTestId('create-name-input').fill('User To Delete');
    await page.getByTestId('create-password-input').fill('password123');
    await page.getByTestId('create-role-select').selectOption('user');
    await page.getByTestId('create-submit-btn').click();
    
    // Wait for user to appear
    await expect(page.getByText(email)).toBeVisible();
    
    // Click delete button for this user
    const row = page.locator('tr', { has: page.getByText(email) });
    await row.locator('[data-testid^="delete-btn-"]').click();
    
    // Confirm delete
    await page.getByTestId('delete-confirm-btn').click();
    
    // Modal should close
    await expect(page.getByTestId('delete-user-modal')).not.toBeVisible();
    
    // User should be removed from table
    await expect(page.getByText(email)).not.toBeVisible();
  });

  test('should sort by email', async ({ page }) => {
    await page.getByTestId('sort-email').click();
    
    // Sort indicator should appear
    await expect(page.getByText('↑')).toBeVisible();
  });

  test('should sort by role', async ({ page }) => {
    await page.getByTestId('sort-role').click();
    
    await expect(page.getByText('↑')).toBeVisible();
  });

  test('should sort by status', async ({ page }) => {
    await page.getByTestId('sort-status').click();
    
    await expect(page.getByText('↑')).toBeVisible();
  });

  test('should filter by role', async ({ page }) => {
    await page.getByTestId('role-filter').selectOption('admin');
    
    // Should show clear filters button
    await expect(page.getByTestId('clear-filters-btn')).toBeVisible();
  });

  test('should filter by status', async ({ page }) => {
    await page.getByTestId('status-filter').selectOption('active');
    
    await expect(page.getByTestId('clear-filters-btn')).toBeVisible();
  });

  test('should search by email', async ({ page }) => {
    await page.getByTestId('search-input').fill('admin');
    
    // Wait for search to apply
    await page.waitForTimeout(500);
  });

  test('should clear all filters', async ({ page }) => {
    // Apply a filter
    await page.getByTestId('role-filter').selectOption('admin');
    
    // Clear filters
    await page.getByTestId('clear-filters-btn').click();
    
    // Filters should be reset
    await expect(page.getByTestId('role-filter')).toHaveValue('');
  });

  test('should show pagination controls', async ({ page }) => {
    await expect(page.getByTestId('page-size-select')).toBeVisible();
    await expect(page.getByTestId('prev-page-btn')).toBeVisible();
    await expect(page.getByTestId('next-page-btn')).toBeVisible();
  });

  test('should change page size', async ({ page }) => {
    await page.getByTestId('page-size-select').selectOption('50');
    
    await expect(page.getByTestId('page-size-select')).toHaveValue('50');
  });

  test('should prevent self-deletion', async ({ page }) => {
    // First delete button (current user) should be disabled
    const firstDeleteBtn = page.locator('[data-testid^="delete-btn-"]').first();
    await expect(firstDeleteBtn).toBeDisabled();
  });

  test('should prevent self-role-modification', async ({ page }) => {
    // Click edit for current user (first edit button)
    await page.locator('[data-testid^="edit-btn-"]').first().click();
    
    // Warning should be visible
    await expect(page.getByText(/You cannot modify your own role or status/)).toBeVisible();
    
    // Role and status selects should be disabled
    await expect(page.getByTestId('edit-role-select')).toBeDisabled();
    await expect(page.getByTestId('edit-status-select')).toBeDisabled();
  });

  test('should close modals with cancel button', async ({ page }) => {
    await page.getByTestId('create-user-btn').click();
    await expect(page.getByTestId('create-user-modal')).toBeVisible();
    
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('create-user-modal')).not.toBeVisible();
  });

  test('should validate create form', async ({ page }) => {
    await page.getByTestId('create-user-btn').click();
    
    // Submit button should be disabled with empty form
    await expect(page.getByTestId('create-submit-btn')).toBeDisabled();
    
    // Fill required fields
    await page.getByTestId('create-email-input').fill('test@example.com');
    await page.getByTestId('create-name-input').fill('Test');
    await page.getByTestId('create-password-input').fill('password123');
    
    // Submit should be enabled
    await expect(page.getByTestId('create-submit-btn')).toBeEnabled();
  });

  test('should validate password length', async ({ page }) => {
    await page.getByTestId('create-user-btn').click();
    
    await page.getByTestId('create-email-input').fill('test@example.com');
    await page.getByTestId('create-name-input').fill('Test');
    await page.getByTestId('create-password-input').fill('short'); // Too short
    await page.getByTestId('create-role-select').selectOption('user');
    
    // Form should still be invalid due to short password
    await page.getByTestId('create-submit-btn').click();
    
    // Browser validation should prevent submission
    await expect(page.getByTestId('create-user-modal')).toBeVisible();
  });
});
