/**
 * IRC Profiles Management Page
 *
 * Admin panel for managing IRC connection profiles (INT-010)
 * RBAC:
 * - Super Admin: full CRUD, test, activate, disable, delete
 * - Admin/Manager: read-only
 * - User: no access
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ircProfilesService,
  IrcProfileResponse,
  CreateIrcProfileRequest,
} from '../services/ircProfiles.service';

export function IrcProfilesPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<IrcProfileResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testingProfileId, setTestingProfileId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    profileId: number;
    success: boolean;
    message: string;
  } | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    if (!canManage) {
      setError('You do not have access to IRC profile management');
      setLoading(false);
      return;
    }
    loadProfiles();
  }, [canManage]);

  async function loadProfiles() {
    try {
      setLoading(true);
      setError(null);
      const data = await ircProfilesService.listProfiles();
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection(profileId: number) {
    try {
      setTestingProfileId(profileId);
      const result = await ircProfilesService.testConnection(profileId);
      setTestResult({ profileId, ...result });
    } catch (err) {
      setTestResult({
        profileId,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTestingProfileId(null);
    }
  }

  async function handleActivate(profileId: number) {
    try {
      await ircProfilesService.activateProfile(profileId);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate profile');
    }
  }

  async function handleDisable(profileId: number) {
    try {
      await ircProfilesService.disableProfile(profileId);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable profile');
    }
  }

  async function handleDelete(profileId: number) {
    if (!window.confirm('Are you sure you want to delete this profile?')) {
      return;
    }
    try {
      await ircProfilesService.deleteProfile(profileId);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="alert alert-error max-w-md">
          <span>You do not have permission to access IRC profiles</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-base-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">IRC Profiles</h1>
            <p className="text-base-content/70 mt-1">
              Manage IRC connection profiles
            </p>
          </div>

          {isSuperAdmin && !showCreateForm && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
              data-testid="create-profile-btn"
            >
              Create Profile
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mb-6" data-testid="error-alert">
            <span>{error}</span>
            <button
              className="btn btn-sm"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && isSuperAdmin && (
          <CreateProfileForm
            onSuccess={() => {
              setShowCreateForm(false);
              loadProfiles();
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Profiles List */}
        {profiles.length === 0 ? (
          <div className="alert alert-info" data-testid="empty-state">
            <span>No IRC profiles configured yet</span>
          </div>
        ) : (
          <div className="grid gap-6">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="card bg-base-200 shadow-md"
                data-testid={`profile-card-${profile.id}`}
              >
                <div className="card-body">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="card-title">{profile.name}</h2>
                      <p className="text-sm text-base-content/70">
                        {profile.config.server}:{profile.config.port}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {profile.isActive && (
                        <div className="badge badge-success">Active</div>
                      )}
                      {!profile.isEnabled && (
                        <div className="badge badge-error">Disabled</div>
                      )}
                    </div>
                  </div>

                  {/* Config Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-semibold">Username:</span>
                      <span className="ml-2">{profile.config.username}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Channels:</span>
                      <span className="ml-2">{profile.config.channels.join(', ')}</span>
                    </div>
                  </div>

                  {/* Test Status */}
                  {profile.lastTestedAt && (
                    <div className="text-sm text-base-content/70 mb-4">
                      <span>Last tested: {new Date(profile.lastTestedAt).toLocaleString()}</span>
                      {profile.lastTestPassed !== undefined && (
                        <span
                          className={`ml-3 badge ${
                            profile.lastTestPassed
                              ? 'badge-success'
                              : 'badge-error'
                          }`}
                        >
                          {profile.lastTestPassed ? 'Passed' : 'Failed'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Test Result Alert */}
                  {testResult?.profileId === profile.id && (
                    <div
                      className={`alert mb-4 ${
                        testResult.success ? 'alert-success' : 'alert-error'
                      }`}
                      data-testid={`test-result-${profile.id}`}
                    >
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isSuperAdmin && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        className={`btn btn-sm ${
                          testingProfileId === profile.id
                            ? 'btn-disabled'
                            : 'btn-outline'
                        }`}
                        onClick={() => handleTestConnection(profile.id)}
                        disabled={testingProfileId === profile.id}
                        data-testid={`test-btn-${profile.id}`}
                      >
                        {testingProfileId === profile.id ? (
                          <>
                            <span className="loading loading-spinner loading-xs"></span>
                            Testing...
                          </>
                        ) : (
                          'Test Connection'
                        )}
                      </button>

                      {!profile.isActive ? (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleActivate(profile.id)}
                          data-testid={`activate-btn-${profile.id}`}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleDisable(profile.id)}
                          data-testid={`disable-btn-${profile.id}`}
                        >
                          Disable
                        </button>
                      )}

                      <button
                        className="btn btn-sm btn-error"
                        onClick={() => handleDelete(profile.id)}
                        disabled={profile.isActive}
                        title={profile.isActive ? 'Disable before deleting' : ''}
                        data-testid={`delete-btn-${profile.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Create Profile Form Component
 */
interface CreateProfileFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateProfileForm({ onSuccess, onCancel }: CreateProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    server: '',
    port: 6667,
    username: '',
    password: '',
    channels: '' as string,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const channels = formData.channels
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (channels.length === 0) {
        throw new Error('At least one channel is required');
      }

      const payload: CreateIrcProfileRequest = {
        name: formData.name,
        config: {
          server: formData.server,
          port: formData.port,
          username: formData.username,
          channels,
        },
        password: formData.password || undefined,
      };

      await ircProfilesService.createProfile(payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card bg-base-200 shadow-md mb-6" data-testid="create-form">
      <div className="card-body">
        <h3 className="card-title mb-4">Create New IRC Profile</h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Profile Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="e.g., Production IRC"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="profile-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Server *</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="irc.example.com"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                required
                data-testid="server-input"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Port *</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                placeholder="6667"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) })
                }
                required
                min="1"
                max="65535"
                data-testid="port-input"
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Username *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="bot_user"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              data-testid="username-input"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Password (optional)</span>
            </label>
            <input
              type="password"
              className="input input-bordered"
              placeholder="Leave empty if not required"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              data-testid="password-input"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Channels (comma-separated, e.g. #general, #dev) *
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="#general, #dev"
              value={formData.channels}
              onChange={(e) => setFormData({ ...formData, channels: e.target.value })}
              required
              data-testid="channels-input"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              data-testid="submit-btn"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Creating...
                </>
              ) : (
                'Create Profile'
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onCancel}
              disabled={loading}
              data-testid="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
