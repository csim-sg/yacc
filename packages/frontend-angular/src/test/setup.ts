/**
 * Unit-test global setup (ANG-003).
 *
 * Ported from the React package's `src/test/setup.ts` per SPEC-001 T4 §4.3:
 * browser-API mocks only. The Vite `import.meta.env` mock is deliberately NOT
 * ported — build-time environment files replace it (ARCH-005 boundary 6) —
 * and the jest-dom matchers are React/Testing-Library-specific and dropped
 * (no @testing-library/angular dependency; component behavior stays E2E's job).
 */

import { vi } from 'vitest';

// Mock window.matchMedia (jsdom does not implement it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (jsdom does not implement it)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver (jsdom does not implement it)
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
