/**
 * IRC Profiles Service
 * 
 * API client for IRC profile management (INT-010)
 */

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000';
}

const API_BASE_URL = getApiBaseUrl();

export interface IrcProfileResponse {
  id: number;
  name: string;
  isEnabled: boolean;
  isActive: boolean;
  config: {
    server: string;
    port: number;
    username: string;
    channels: string[];
  };
  hasPassword: boolean;
  lastTestedAt?: string;
  lastTestPassed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIrcProfileRequest {
  name: string;
  config: {
    server: string;
    port: number;
    username: string;
    channels: string[];
  };
  password?: string;
}

export interface UpdateIrcProfileRequest {
  name?: string;
  config?: {
    server: string;
    port: number;
    username: string;
    channels: string[];
  };
  password?: string;
}

export interface TestConnectionResult {
  passed: boolean;
  reason?: string;
  duration: number;
}

class IrcProfilesService {
  private baseUrl = `${API_BASE_URL}/api/integrations/irc/profiles`;

  async listProfiles(): Promise<IrcProfileResponse[]> {
    const response = await fetch(this.baseUrl, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to list IRC profiles: ${response.statusText}`);
    }
    return response.json();
  }

  async getProfile(id: number): Promise<IrcProfileResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to get IRC profile: ${response.statusText}`);
    }
    return response.json();
  }

  async createProfile(data: CreateIrcProfileRequest): Promise<IrcProfileResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create IRC profile');
    }
    return response.json();
  }

  async updateProfile(
    id: number,
    data: UpdateIrcProfileRequest
  ): Promise<IrcProfileResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update IRC profile');
    }
    return response.json();
  }

  async activateProfile(id: number): Promise<IrcProfileResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to activate IRC profile');
    }
    return response.json();
  }

  async disableProfile(id: number): Promise<IrcProfileResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disable IRC profile');
    }
    return response.json();
  }

  async deleteProfile(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete IRC profile');
    }
  }

  async testConnection(id: number): Promise<TestConnectionResult> {
    const response = await fetch(`${this.baseUrl}/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Test connection failed');
    }
    return response.json();
  }
}

export const ircProfilesService = new IrcProfilesService();
