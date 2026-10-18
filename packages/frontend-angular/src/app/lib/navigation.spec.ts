import { getAccessibleNavItems, hasAccessToRoute, meetsRoleRequirement, NAVIGATION_ITEMS, ROLE_HIERARCHY } from './navigation';

/**
 * Navigation config spec (ANG-004, W23).
 *
 * Pins the role-filtered visibility matrix (mirroring the fe-003
 * `NAVIGATION_PER_ROLE` expectation) and the role hierarchy used by
 * `roleGuard`.
 */
describe('navigation config', () => {
  it('exposes the seven navigation items in render order', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.href)).toEqual([
      '/inbox',
      '/audit-logs',
      '/users',
      '/integrations',
      '/integrations/irc-profiles',
      '/routing-rules',
      '/settings',
    ]);
  });

  it('shows every item to SUPER_ADMIN', () => {
    const labels = getAccessibleNavItems('SUPER_ADMIN').map((item) => item.label);
    expect(labels).toEqual([
      'Inbox',
      'Audit Logs',
      'Users',
      'Integrations',
      'IRC Profiles',
      'Routing Rules',
      'Settings',
    ]);
  });

  it('shows Inbox/Audit Logs/IRC Profiles/Routing Rules/Settings to ADMIN (no users/integrations)', () => {
    const labels = getAccessibleNavItems('ADMIN').map((item) => item.label);
    expect(labels).toEqual(['Inbox', 'Audit Logs', 'IRC Profiles', 'Routing Rules', 'Settings']);
  });

  it('shows Inbox/Audit Logs/IRC Profiles to MANAGER', () => {
    const labels = getAccessibleNavItems('MANAGER').map((item) => item.label);
    expect(labels).toEqual(['Inbox', 'Audit Logs', 'IRC Profiles']);
  });

  it('shows only Inbox to USER', () => {
    const labels = getAccessibleNavItems('USER').map((item) => item.label);
    expect(labels).toEqual(['Inbox']);
  });

  it('grants route access only to allowed roles', () => {
    expect(hasAccessToRoute('SUPER_ADMIN', '/users')).toBe(true);
    expect(hasAccessToRoute('ADMIN', '/users')).toBe(false);
    expect(hasAccessToRoute('USER', '/inbox')).toBe(true);
    expect(hasAccessToRoute('USER', '/audit-logs')).toBe(false);
    expect(hasAccessToRoute('USER', '/nonexistent')).toBe(false);
  });

  it('orders the role hierarchy USER < MANAGER < ADMIN < SUPER_ADMIN', () => {
    expect(ROLE_HIERARCHY.USER).toBeLessThan(ROLE_HIERARCHY.MANAGER);
    expect(ROLE_HIERARCHY.MANAGER).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.SUPER_ADMIN);
  });

  it('meets role requirements across the hierarchy', () => {
    expect(meetsRoleRequirement('SUPER_ADMIN', 'USER')).toBe(true);
    expect(meetsRoleRequirement('ADMIN', 'MANAGER')).toBe(true);
    expect(meetsRoleRequirement('MANAGER', 'MANAGER')).toBe(true);
    expect(meetsRoleRequirement('USER', 'MANAGER')).toBe(false);
    expect(meetsRoleRequirement('MANAGER', 'ADMIN')).toBe(false);
  });
});
