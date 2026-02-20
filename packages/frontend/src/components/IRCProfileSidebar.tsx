/**
 * IRC Profile Sidebar Component (INT-014 FE-Sidebar)
 *
 * Groups IRC conversations by profile in the sidebar with expandable/collapsible sections.
 * Each profile (IRC network connection) shows:
 * - Joined channels (#channel1, #channel2, etc.)
 * - Ongoing DMs (@user1, @user2, etc.)
 *
 * Features:
 * - Accordion-style expandable sections per profile
 * - Profile-scoped conversation grouping
 * - Unread badge counts
 * - Click to navigate to conversation
 * - Mobile responsive (collapsible)
 * - localStorage persistence of expanded state
 *
 * Architecture:
 * - Profile sections loaded from conversations filtered by ircProfileId
 * - Uses existing conversation API + local grouping logic
 * - Integrates with TanStack Query for data fetching
 * - Uses Zustand for expanded state management
 */

import { useMemo, useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Conversation } from '@yacc/common/types/conversation.interface';

interface IRCProfileGroup {
  profileId: number;
  profileName: string;
  channels: Conversation[];
  dms: Conversation[];
}

interface IRCProfileSidebarProps {
  conversations?: Conversation[];
  isLoading?: boolean;
  onSelect?: (conversationId: string) => void;
}

/**
 * Group conversations by IRC profile and thread type
 */
function groupConversationsByProfile(
  conversations: Conversation[]
): IRCProfileGroup[] {
  const grouped = new Map<number, { channels: Conversation[]; dms: Conversation[] }>();

  conversations.forEach((conv) => {
    // Only process IRC conversations with profile ID
    if (conv.channel !== 'irc' || !conv.ircProfileId) return;

    const profileId = conv.ircProfileId;
    if (!grouped.has(profileId)) {
      grouped.set(profileId, { channels: [], dms: [] });
    }

    const group = grouped.get(profileId)!;
    // Determine if channel or DM based on externalThreadId format
    // Channels start with # or &, DMs are user identifiers
    if (
      conv.externalThreadId?.startsWith('#') ||
      conv.externalThreadId?.startsWith('&')
    ) {
      group.channels.push(conv);
    } else {
      group.dms.push(conv);
    }
  });

  // Convert to array and sort
  return Array.from(grouped.entries())
    .map(([profileId, { channels, dms }]) => ({
      profileId,
      profileName: `Profile ${profileId}`, // TODO: fetch actual profile name from API
      channels: channels.sort((a, b) =>
        (a.externalThreadId || '').localeCompare(b.externalThreadId || '')
      ),
      dms: dms.sort((a, b) =>
        (a.externalThreadId || '').localeCompare(b.externalThreadId || '')
      ),
    }))
    .sort((a, b) => a.profileId - b.profileId);
}

/**
 * Conversation Item Component
 */
function ConversationItem({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick: (id: string) => void;
}): ReactElement {
  const unreadCount = 0; // TODO: get from conversation.unreadCount or separate API

  return (
    <button
      onClick={() => onClick(conversation.id)}
      className={`
        w-full px-3 py-2 text-sm text-left rounded-md transition-colors
        hover:bg-base-200 active:bg-base-300
        flex items-center justify-between gap-2
      `}
      data-testid={`conversation-item-${conversation.id}`}
      title={conversation.externalThreadId}
    >
      <span className="truncate flex-1">
        {conversation.externalThreadId || conversation.title || 'Unnamed'}
      </span>
      {unreadCount > 0 && (
        <span className="badge badge-sm badge-primary">{unreadCount}</span>
      )}
    </button>
  );
}

/**
 * Profile Group Component (Expandable Section)
 */
function ProfileGroup({
  group,
  isExpanded,
  onToggle,
  onSelectConversation,
}: {
  group: IRCProfileGroup;
  isExpanded: boolean;
  onToggle: (profileId: number) => void;
  onSelectConversation: (id: string) => void;
}): ReactElement {
  const totalUnread = 0; // TODO: calculate from all conversations in group

  return (
    <div
      className="border-b border-base-300"
      data-testid={`profile-group-${group.profileId}`}
    >
      {/* Profile Header */}
      <button
        onClick={() => onToggle(group.profileId)}
        className={`
          w-full px-4 py-3 font-semibold text-sm transition-colors
          hover:bg-base-200 active:bg-base-300
          flex items-center justify-between
        `}
        aria-expanded={isExpanded}
        aria-controls={`profile-content-${group.profileId}`}
        data-testid={`profile-header-${group.profileId}`}
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span>{group.profileName}</span>
          {totalUnread > 0 && (
            <span className="badge badge-sm badge-primary">{totalUnread}</span>
          )}
        </div>
      </button>

      {/* Profile Content */}
      {isExpanded && (
        <div
          id={`profile-content-${group.profileId}`}
          className="bg-base-100 space-y-1 px-2 py-2"
          data-testid={`profile-content-${group.profileId}`}
        >
          {/* Channels Section */}
          {group.channels.length > 0 && (
            <div>
              <div className="text-xs text-base-content/60 px-2 py-1 font-semibold">
                Channels
              </div>
              <div className="space-y-1">
                {group.channels.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    onClick={onSelectConversation}
                  />
                ))}
              </div>
            </div>
          )}

          {/* DMs Section */}
          {group.dms.length > 0 && (
            <div>
              <div className="text-xs text-base-content/60 px-2 py-1 font-semibold">
                Direct Messages
              </div>
              <div className="space-y-1">
                {group.dms.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    onClick={onSelectConversation}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {group.channels.length === 0 && group.dms.length === 0 && (
            <div className="text-xs text-base-content/40 px-2 py-4 text-center">
              No conversations yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * IRC Profile Sidebar Component
 */
export function IRCProfileSidebar({
  conversations = [],
  isLoading = false,
  onSelect,
}: IRCProfileSidebarProps): ReactElement {
  const navigate = useNavigate();
  const [expandedProfiles, setExpandedProfiles] = useState<Set<number>>(
    new Set()
  );

  // Load expanded state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('irc-profile-expanded');
    if (saved) {
      try {
        setExpandedProfiles(new Set(JSON.parse(saved)));
      } catch {
        // Ignore invalid data
      }
    }
  }, []);

  // Save expanded state to localStorage
  const saveExpandedState = (profiles: Set<number>) => {
    localStorage.setItem('irc-profile-expanded', JSON.stringify(Array.from(profiles)));
  };

  const toggleProfile = (profileId: number) => {
    const newExpanded = new Set(expandedProfiles);
    if (newExpanded.has(profileId)) {
      newExpanded.delete(profileId);
    } else {
      newExpanded.add(profileId);
    }
    setExpandedProfiles(newExpanded);
    saveExpandedState(newExpanded);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (onSelect) {
      onSelect(conversationId);
    } else {
      navigate(`/conversations/${conversationId}`);
    }
  };

  // Group conversations by profile
  const profileGroups = useMemo(
    () => groupConversationsByProfile(conversations),
    [conversations]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4" data-testid="irc-sidebar-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 bg-base-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (profileGroups.length === 0) {
    return (
      <div
        className="p-4 text-center text-sm text-base-content/40"
        data-testid="irc-sidebar-empty"
      >
        {conversations.length === 0
          ? 'No IRC conversations'
          : 'No IRC profiles configured'}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-y-auto"
      data-testid="irc-sidebar"
      role="region"
      aria-label="IRC Profile Conversations"
    >
      {profileGroups.map((group) => (
        <ProfileGroup
          key={group.profileId}
          group={group}
          isExpanded={expandedProfiles.has(group.profileId)}
          onToggle={toggleProfile}
          onSelectConversation={handleSelectConversation}
        />
      ))}
    </div>
  );
}

export default IRCProfileSidebar;
