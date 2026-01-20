/**
 * Frontend Login E2E Tests
 * Tests the complete login flow from UI to backend
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

test.describe('Frontend Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${FRONTEND_URL}/login`);
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Welcome Back');
    
    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check links
    await expect(page.locator('text=Forgot Password?')).toBeVisible();
    await expect(page.locator('text=Create One')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit empty form
    await page.locator('button[type="submit"]').click();
    
    // HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isEmailInvalid).toBeTruthy();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('admin123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for navigation to inbox
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 5000 });
    
    // Verify we're on the inbox page
    await expect(page.locator('text=YACC Inbox')).toBeVisible();
    
    // Verify user menu shows correct info
    await page.locator('[role="button"].avatar').click();
    await expect(page.locator('.dropdown-content').locator('text=System Administrator')).toBeVisible();
    await expect(page.locator('.dropdown-content').locator('text=admin@yacc.local')).toBeVisible();
    await expect(page.locator('.dropdown-content').locator('text=super admin')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in login form with wrong password
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('wrongpassword');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for error message
    await expect(page.locator('.alert-error')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.alert-error')).toContainText('Invalid email or password');
    
    // Verify we're still on login page
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  });

  test('should show error for non-existent user', async ({ page }) => {
    // Fill in login form with non-existent email
    await page.locator('input[type="email"]').fill('nonexistent@yacc.local');
    await page.locator('input[type="password"]').fill('password123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for error message
    await expect(page.locator('.alert-error')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.alert-error')).toContainText('Invalid email or password');
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('input#password');
    const toggleButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle button
    await toggleButton.click();
    
    // Password should now be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleButton.click();
    
    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should persist authentication after page reload', async ({ page, context }) => {
    // Login
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // Wait for inbox
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    // Reload page
    await page.reload();
    
    // Should still be on inbox (not redirected to login)
    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
    await expect(page.locator('text=YACC Inbox')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // Wait for inbox
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    // Click user avatar to open menu
    await page.locator('[role="button"].avatar').click();
    
    // Click logout button
    await page.locator('button:has-text("Logout")').click();
    
    // Should redirect to login page
    await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    // Verify we're on login page
    await expect(page.locator('h1')).toContainText('Welcome Back');
  });

  test('should redirect to inbox if already logged in', async ({ page, context }) => {
    // Login first
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // Wait for inbox
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    // Try to navigate to login page
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Should be redirected back to inbox
    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
    await expect(page.locator('text=YACC Inbox')).toBeVisible();
  });

  test('should disable submit button while loading', async ({ page }) => {
    // Fill in form
    await page.locator('input[type="email"]').fill('admin@yacc.local');
    await page.locator('input[type="password"]').fill('admin123');
    
    // Click submit
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Button should be disabled immediately
    await expect(submitButton).toBeDisabled();
    
    // Should show loading text
    await expect(submitButton).toContainText('Signing in');
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing inbox without auth', async ({ page }) => {
    // Try to access inbox directly
    await page.goto(`${FRONTEND_URL}/`);
    
    // Should be redirected to login
    await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 3000 });
    await expect(page.locator('h1')).toContainText('Welcome Back');
  });

  test('should redirect to login when token expires', async ({ page, context }) => {
    // This would require mocking expired token
    // For MVP, we skip this test
    test.skip();
  });
});
