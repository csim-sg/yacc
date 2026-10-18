import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IrcProfilesStore } from './irc-profiles.store';

/**
 * IrcProfilesStore spec (AC-ANG-005-2; T2 §3.1 family store — the React
 * raw-fetch third HTTP path is gone): list + detail on canonical keys;
 * mutations invalidate; tests are actions without cache impact.
 */
describe('IrcProfilesStore', () => {
  let store: IrcProfilesStore;
  let http: HttpTestingController;

  const profile = {
    id: 7,
    name: 'ops-irc',
    isEnabled: false,
    isActive: false,
    config: { server: 'irc.example.com', port: 6697, username: 'yacc', channels: ['#ops'] },
    hasPassword: false,
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(IrcProfilesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function loadProfiles(): Promise<void> {
    const pending = store.loadProfiles();
    http.expectOne('/api/integrations/irc/profiles').flush([profile]);
    return pending;
  }

  it('loads the raw profiles list and the detail key', async () => {
    await loadProfiles();
    expect(store.listSnapshot()?.data).toEqual([profile]);

    const detail = store.loadProfile(7);
    http.expectOne('/api/integrations/irc/profiles/7').flush(profile);
    await detail;
    expect(store.detailSnapshot(7)?.data).toEqual(profile);
  });

  it('create/activate/disable/delete invalidate the profiles caches', async () => {
    await loadProfiles();

    const created = store.createProfile({ name: 'ops-irc', config: profile.config });
    http.expectOne('/api/integrations/irc/profiles').flush(profile);
    await created;
    await loadProfiles();

    const activated = store.activateProfile(7);
    http.expectOne('/api/integrations/irc/profiles/7/activate').flush(profile);
    await activated;
    await loadProfiles();

    const disabled = store.disableProfile(7);
    http.expectOne('/api/integrations/irc/profiles/7/disable').flush(profile);
    await disabled;
    await loadProfiles();

    const deleted = store.deleteProfile(7);
    http.expectOne('/api/integrations/irc/profiles/7').flush(null);
    await deleted;
    await loadProfiles();
  });

  it('testConnection returns the raw test result without touching the cache', async () => {
    await loadProfiles();

    const pending = store.testConnection(7);
    http.expectOne('/api/integrations/irc/profiles/7/test').flush({ passed: true, duration: 120 });

    await expect(pending).resolves.toEqual({ passed: true, duration: 120 });
    http.expectNone('/api/integrations/irc/profiles');
  });
});
