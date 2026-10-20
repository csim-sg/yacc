import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  CreateIrcProfileRequest,
  IrcProfile,
  IrcTestRequest,
  IrcTestResponse,
  ListIrcProfilesResponse,
  TestConnectionResult,
  UpdateIrcProfileRequest,
} from '../contracts/http/irc.schema';
import { mutationContext } from '../interceptors/http-context';

/**
 * IRC-profiles HTTP service (T2 §3.5): the React `ircProfiles.service.ts`
 * raw-`fetch` path (finding F3) is NOT replicated — this is the standard
 * HttpClient surface, ending the third HTTP path. Responses are raw
 * (no envelope) per the frozen contract. Owns IO only; state lives in
 * `IrcProfilesStore`.
 */
@Injectable({ providedIn: 'root' })
export class IrcProfilesService {
  private readonly baseUrl = '/api/integrations/irc/profiles';
  private readonly http = inject(HttpClient);

  /** GET /api/integrations/irc/profiles — raw array. */
  list(): Promise<ListIrcProfilesResponse> {
    return firstValueFrom(this.http.get<ListIrcProfilesResponse>(this.baseUrl));
  }

  /** GET /api/integrations/irc/profiles/:id — raw profile. */
  getById(profileId: number): Promise<IrcProfile> {
    return firstValueFrom(this.http.get<IrcProfile>(`${this.baseUrl}/${profileId}`));
  }

  /** POST /api/integrations/irc/profiles — raw profile. */
  create(body: CreateIrcProfileRequest): Promise<IrcProfile> {
    return firstValueFrom(
      this.http.post<IrcProfile>(this.baseUrl, body, { context: mutationContext() }),
    );
  }

  /** PUT /api/integrations/irc/profiles/:id — raw profile. */
  update(profileId: number, body: UpdateIrcProfileRequest): Promise<IrcProfile> {
    return firstValueFrom(
      this.http.put<IrcProfile>(`${this.baseUrl}/${profileId}`, body, {
        context: mutationContext(),
      }),
    );
  }

  /** POST /api/integrations/irc/profiles/:id/activate — raw profile. */
  activate(profileId: number): Promise<IrcProfile> {
    return firstValueFrom(
      this.http.post<IrcProfile>(`${this.baseUrl}/${profileId}/activate`, undefined, {
        context: mutationContext(),
      }),
    );
  }

  /** POST /api/integrations/irc/profiles/:id/disable — raw profile. */
  disable(profileId: number): Promise<IrcProfile> {
    return firstValueFrom(
      this.http.post<IrcProfile>(`${this.baseUrl}/${profileId}/disable`, undefined, {
        context: mutationContext(),
      }),
    );
  }

  /** DELETE /api/integrations/irc/profiles/:id. */
  delete(profileId: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${profileId}`, { context: mutationContext() }),
    );
  }

  /** POST /api/integrations/irc/profiles/:id/test — raw test result. */
  testConnection(profileId: number): Promise<TestConnectionResult> {
    return firstValueFrom(
      this.http.post<TestConnectionResult>(`${this.baseUrl}/${profileId}/test`, undefined, {
        context: mutationContext(),
      }),
    );
  }

  /** POST /api/integrations/irc/test — live W16 ad-hoc connection test. */
  testAdHocConnection(request: IrcTestRequest): Promise<IrcTestResponse> {
    return firstValueFrom(
      this.http.post<IrcTestResponse>('/api/integrations/irc/test', request ?? {}, {
        context: mutationContext(),
      }),
    );
  }
}
