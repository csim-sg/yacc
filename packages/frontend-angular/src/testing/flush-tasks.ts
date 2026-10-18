/**
 * Drain the pending microtask/macrotask chain of an async handler
 * (`await` boundaries inside component/service handlers resolve on the
 * macrotask queue under zone.js — `whenStable()` alone does not flush
 * them). Test-only helper for spec files.
 */
export function flushTasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
