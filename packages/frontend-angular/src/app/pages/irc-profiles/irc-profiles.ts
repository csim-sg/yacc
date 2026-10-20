import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type {
  CreateIrcProfileRequest,
  IrcProfile,
  IrcTestRequest,
  TestConnectionResult,
} from '../../contracts/http/irc.schema';
import { apiErrorMessage } from '../../lib/api-error-message';
import { IrcTestButton } from '../../components/irc-test-button/irc-test-button';
import { AuthService } from '../../services/auth.service';
import type { ResourceSnapshot } from '../../services/resource-state';
import { IrcProfilesStore } from '../../services/irc-profiles.store';

/** React `useState(6667)` default port. */
const DEFAULT_IRC_PORT = 6667;

/** Per-profile test result row (React `testResult` state). */
interface ProfileTestResult {
  profileId: number;
  passed: boolean;
  reason?: string;
  duration: number;
}

/**
 * IRC Profiles page (React `pages/IrcProfilesPage.tsx` port — W16; the
 * React `CreateProfileForm` sub-component folds into this component the
 * way the users-page modals did, and the `IRCTestButton` child ports as
 * `components/irc-test-button`).
 *
 * Profiles CRUD + activate/disable/test surface over the canonical store:
 * the list rides `IrcProfilesStore.loadProfiles` (30s-fresh repeat visits
 * are store cache hits); create/activate/disable/delete ride the store
 * mutations which invalidate the profiles caches and refetch (React
 * explicit `loadProfiles()` after each mutation parity). The per-profile
 * connection test is an action without cache impact.
 *
 * RBAC (React in-component gates parity): only SUPER_ADMIN sees the
 * create form and the per-card Test/Activate/Disable/Delete actions
 * (`isSuperAdmin`); SUPER_ADMIN/ADMIN/MANAGER may read (`canManage`),
 * anyone else gets the permission alert. The route additionally carries
 * `roleGuard('ADMIN')` (React `ProtectedRoute requiredRole="ADMIN"`
 * parity) — UX only, the backend `@Authorized` stays the security
 * boundary.
 */
@Component({
  selector: 'app-irc-profiles',
  imports: [FormsModule, IrcTestButton],
  templateUrl: './irc-profiles.html',
})
export class IrcProfiles {
  private readonly store = inject(IrcProfilesStore);
  private readonly auth = inject(AuthService);

  /** React `showCreateForm`. */
  protected readonly showCreateForm = signal(false);

  /** React `testingProfileId` — disables the testing card's button. */
  protected readonly testingProfileId = signal<number | null>(null);

  /** React `testResult` — last per-profile connection test outcome. */
  protected readonly testResult = signal<ProfileTestResult | null>(null);

  /**
   * React `error` (dismissable) — action failures (activate/disable/
   * delete) and the no-access alert. List-load failures surface through
   * the snapshot error with Retry (users/routing-rules page precedent).
   */
  protected readonly actionError = signal<string | null>(null);

  /** Create-form pending state (React `CreateProfileForm` `loading`). */
  protected readonly isCreating = signal(false);
  /** Create-form error (React `CreateProfileForm` `error`). */
  protected readonly formError = signal<string | null>(null);

  /** Create-form fields (React `CreateProfileForm` `formData`). */
  protected nameInput = '';
  protected serverInput = '';
  protected portInput: number = DEFAULT_IRC_PORT;
  protected usernameInput = '';
  protected passwordInput = '';
  protected channelsInput = '';

  /** List resource snapshot (null while the first load is pending). */
  protected readonly listSnapshot = computed<ResourceSnapshot<IrcProfile[]> | null>(
    () => this.store.listSnapshot() ?? null,
  );

  /** Loaded profile rows. */
  protected readonly profiles = computed<IrcProfile[]>(() => this.listSnapshot()?.data ?? []);

  /** First load with nothing to show yet (React `isLoading` parity). */
  protected readonly isLoading = computed(() => {
    const snapshot = this.listSnapshot();
    return snapshot === null || (snapshot.loading && snapshot.data === undefined);
  });

  /** React `isSuperAdmin` — exact SUPER_ADMIN equality (mutation gate). */
  protected readonly isSuperAdmin = computed(() => this.auth.user()?.role === 'SUPER_ADMIN');

  /** React `canManage` — SUPER_ADMIN/ADMIN/MANAGER may read. */
  protected readonly canManage = computed<boolean>(() =>
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(this.auth.user()?.role ?? ''),
  );

  constructor() {
    // React `useEffect([canManage])` parity: the read gate re-evaluates
    // when the session restore resolves the user signal (the route guard
    // normally guarantees a resolved session; the unit harness renders the
    // bare route). Read-only roles get the access alert instead of a list
    // load; the store's freshness/dedup keeps repeat runs harmless.
    effect(() => {
      if (this.canManage()) {
        this.actionError.set(null);
        void untracked(() => {
          void this.store.loadProfiles();
        });
      } else {
        this.actionError.set('You do not have access to IRC profile management');
      }
    });
  }

  /** Combined error line: dismissable action error, else the load error. */
  protected readonly errorMessage = computed(() => {
    const action = this.actionError();
    if (action !== null) {
      return action;
    }
    const error = this.listSnapshot()?.error;
    return error ? apiErrorMessage(error, 'Failed to load profiles') : null;
  });

  protected readonly hasLoadError = computed(
    () => this.actionError() === null && this.listSnapshot()?.error != null,
  );

  /** React `onClick={() => loadProfiles()}` on the load-error alert. */
  protected retry(): void {
    void this.store.loadProfiles();
  }

  /** React `setShowCreateForm(true)` — fresh form (useState initializers). */
  protected openCreateForm(): void {
    this.formError.set(null);
    this.nameInput = '';
    this.serverInput = '';
    this.portInput = DEFAULT_IRC_PORT;
    this.usernameInput = '';
    this.passwordInput = '';
    this.channelsInput = '';
    this.showCreateForm.set(true);
  }

  /** React `parseInt(e.target.value)` — a cleared field reads as 0. */
  protected onPortChange(value: number | string | null): void {
    const parsed = parseInt(String(value ?? ''), 10);
    this.portInput = Number.isNaN(parsed) ? 0 : parsed;
  }

  /** React `formData.channels` split on commas (trimmed, non-empty). */
  private parsedChannels(): string[] {
    return this.channelsInput
      .split(',')
      .map((channel) => channel.trim())
      .filter((channel) => channel.length > 0);
  }

  /**
   * The frozen test body for the create form's live test button. Disabled
   * until the full frozen `IrcConfigBody` is present (server/username
   * non-empty, port > 0, ≥1 '#'-prefixed channel) — React gated only on
   * server/port/username, but its channel-less body is rejected 400 by
   * the merged Java `IrcTestRequest` bean validation, so the gate follows
   * the frozen contract instead (disclosed parity deviation).
   *
   * Plain getters (not computeds): the form fields are ngModel-bound
   * plain properties, so derived values must re-evaluate on every CD
   * (users-page `createIsValid` precedent).
   */
  protected get testConfig(): IrcTestRequest {
    return {
      server: this.serverInput,
      port: this.portInput,
      username: this.usernameInput,
      password: this.passwordInput || undefined,
      channels: this.parsedChannels(),
    };
  }

  /** React `isTestable` extended with the frozen channels requirement. */
  protected get isTestable(): boolean {
    const channels = this.parsedChannels();
    return (
      this.serverInput.trim() !== '' &&
      this.portInput > 0 &&
      this.usernameInput.trim() !== '' &&
      channels.length > 0 &&
      channels.every((channel) => channel.startsWith('#'))
    );
  }

  /**
   * React `handleSubmit` — parse the channels, require at least one, POST
   * through the store; success closes the form (the store invalidation
   * refetches the list — React's explicit `loadProfiles()` parity). The
   * payload is the frozen flat `IrcProfileWrite` — the form's username
   * field carries the wire `nick`.
   */
  protected async submitCreate(): Promise<void> {
    this.formError.set(null);
    this.isCreating.set(true);
    try {
      const channels = this.parsedChannels();
      if (channels.length === 0) {
        throw new Error('At least one channel is required');
      }
      const payload: CreateIrcProfileRequest = {
        name: this.nameInput,
        server: this.serverInput,
        port: this.portInput,
        nick: this.usernameInput,
        channels,
        password: this.passwordInput || undefined,
      };
      await this.store.createProfile(payload);
      this.showCreateForm.set(false);
    } catch (err: unknown) {
      this.formError.set(apiErrorMessage(err, 'Failed to create profile'));
    } finally {
      this.isCreating.set(false);
    }
  }

  /** React `handleTestConnection` — raw result or a failed result row. */
  protected async handleTestConnection(profileId: number): Promise<void> {
    this.testingProfileId.set(profileId);
    try {
      const result: TestConnectionResult = await this.store.testConnection(profileId);
      this.testResult.set({ profileId, ...result });
    } catch (err: unknown) {
      this.testResult.set({
        profileId,
        passed: false,
        reason: apiErrorMessage(err, 'Test failed'),
        duration: 0,
      });
    } finally {
      this.testingProfileId.set(null);
    }
  }

  /** React `handleActivate` — store POST; invalidation refetches the list. */
  protected async handleActivate(profileId: number): Promise<void> {
    try {
      await this.store.activateProfile(profileId);
    } catch (err: unknown) {
      this.actionError.set(apiErrorMessage(err, 'Failed to activate profile'));
    }
  }

  /** React `handleDisable` — store POST; invalidation refetches the list. */
  protected async handleDisable(profileId: number): Promise<void> {
    try {
      await this.store.disableProfile(profileId);
    } catch (err: unknown) {
      this.actionError.set(apiErrorMessage(err, 'Failed to disable profile'));
    }
  }

  /** React `handleDelete` — confirm, store DELETE, list refetch. */
  protected async handleDelete(profileId: number): Promise<void> {
    if (!globalThis.confirm('Are you sure you want to delete this profile?')) {
      return;
    }
    try {
      await this.store.deleteProfile(profileId);
    } catch (err: unknown) {
      this.actionError.set(apiErrorMessage(err, 'Failed to delete profile'));
    }
  }

  /** React `new Date(...).toLocaleString()` parity. */
  protected formattedDateTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
