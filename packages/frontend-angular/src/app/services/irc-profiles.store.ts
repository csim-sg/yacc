import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { IrcProfile, IrcTestRequest, IrcTestResponse } from '../contracts/http/irc.schema';
import type {
  CreateIrcProfileRequest,
  ListIrcProfilesResponse,
  UpdateIrcProfileRequest,
} from '../contracts/http/irc.schema';
import { IrcProfilesService } from './irc-profiles.service';
import { ResourceState, type ResourceSnapshot } from './resource-state';

/**
 * IRC-profiles resource store (T2 §3.1 family store): profiles list +
 * detail on `ResourceState<T>` (the React raw-fetch path is gone — the
 * HttpClient service is the only IO). Mutations invalidate the profiles
 * caches; connection tests are actions without cache impact.
 */
@Injectable({ providedIn: 'root' })
export class IrcProfilesStore {
  private readonly service = inject(IrcProfilesService);
  private readonly lists = new ResourceState<ListIrcProfilesResponse>();
  private readonly details = new ResourceState<IrcProfile>();

  /** Reactive snapshot of the profiles list, if loaded. */
  listSnapshot(): ResourceSnapshot<ListIrcProfilesResponse> | undefined {
    return this.lists.snapshot(cacheKeys.ircProfiles.all());
  }

  /** Reactive snapshot of one profile detail, if loaded. */
  detailSnapshot(profileId: number): ResourceSnapshot<IrcProfile> | undefined {
    return this.details.snapshot(cacheKeys.ircProfiles.detail(profileId));
  }

  /** Load (or refresh) the profiles list. */
  async loadProfiles(): Promise<void> {
    try {
      await this.lists.load(cacheKeys.ircProfiles.all(), () => this.service.list());
    } catch {
      // State carries the error.
    }
  }

  /** Load (or refresh) one profile detail. */
  async loadProfile(profileId: number): Promise<void> {
    try {
      await this.details.load(
        cacheKeys.ircProfiles.detail(profileId),
        () => this.service.getById(profileId),
      );
    } catch {
      // State carries the error.
    }
  }

  /** POST profiles → invalidate profiles caches. */
  async createProfile(body: CreateIrcProfileRequest): Promise<void> {
    await this.service.create(body);
    this.invalidateProfiles();
  }

  /** PUT profiles/:id → invalidate profiles caches. */
  async updateProfile(profileId: number, body: UpdateIrcProfileRequest): Promise<void> {
    await this.service.update(profileId, body);
    this.invalidateProfiles();
  }

  /** POST profiles/:id/activate → invalidate profiles caches. */
  async activateProfile(profileId: number): Promise<void> {
    await this.service.activate(profileId);
    this.invalidateProfiles();
  }

  /** POST profiles/:id/disable → invalidate profiles caches. */
  async disableProfile(profileId: number): Promise<void> {
    await this.service.disable(profileId);
    this.invalidateProfiles();
  }

  /** DELETE profiles/:id → invalidate profiles caches. */
  async deleteProfile(profileId: number): Promise<void> {
    await this.service.delete(profileId);
    this.invalidateProfiles();
  }

  /** POST profiles/:id/test — raw test result (rejects on failure). */
  testConnection(profileId: number) {
    return this.service.testConnection(profileId);
  }

  /** POST /api/integrations/irc/test — live W16 ad-hoc test. */
  testAdHocConnection(request: IrcTestRequest): Promise<IrcTestResponse> {
    return this.service.testAdHocConnection(request);
  }

  private invalidateProfiles(): void {
    this.lists.invalidate();
    this.details.invalidate();
  }
}
