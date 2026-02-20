# IRC Profile Sidebar Integration Guide

## Overview
The `IRCProfileSidebar` component groups IRC conversations by profile. It should be integrated into the inbox page conversation list sidebar.

## Integration Steps

### 1. Where to Add
In `packages/frontend/src/pages/InboxPage.tsx`, add the IRC sidebar as a section below navigation and above the main conversation list:

```tsx
import { IRCProfileSidebar } from '../components/IRCProfileSidebar';

// In render:
<div className="flex-1 overflow-y-auto">
  {/* Add IRC profile sidebar when channel filter includes IRC */}
  {(channel === 'all' || channel === 'irc') && (
    <div className="border-b border-base-300 mb-4">
      <h3 className="text-sm font-semibold px-4 py-2">IRC Networks</h3>
      <IRCProfileSidebar 
        conversations={ircConversations}
        isLoading={isLoading}
        onSelect={handleConversationClick}
      />
    </div>
  )}
  
  {/* Existing conversation list below */}
  {/* ... rest of conversation list ... */}
</div>
```

### 2. Filter IRC Conversations
From the full `conversations` list, filter to IRC only:

```tsx
const ircConversations = useMemo(
  () => conversations?.filter(c => c.channel === 'irc') || [],
  [conversations]
);
```

### 3. Pass to Component
- `conversations`: Array of IRC Conversation objects
- `isLoading`: Boolean from useQuery
- `onSelect`: Handler to navigate (already have `handleConversationClick`)

### 4. Features Included
- ✅ Profile grouping (accordion sections)
- ✅ Expandable/collapsible per profile
- ✅ Joined channels listed
- ✅ DMs listed separately (ready for Phase 2)
- ✅ Click to open conversation
- ✅ localStorage persistence of expanded state
- ✅ Mobile responsive
- ✅ Accessibility (ARIA labels, data-testid)

## Data Requirements

The component expects `Conversation` objects with:
```typescript
{
  id: string;
  channel: 'irc';
  externalThreadId: string;  // '#channel' or 'username'
  ircProfileId?: number;      // Profile ID (NEW - INT-011)
  title?: string;             // Optional title
  status: ConversationStatus;
  priority: ConversationPriority;
  // ... other fields
}
```

## Testing
Component includes `data-testid` attributes for Playwright E2E:
- `irc-sidebar` - main container
- `irc-sidebar-loading` - loading state
- `irc-sidebar-empty` - empty state
- `profile-header-{profileId}` - profile header button
- `profile-content-{profileId}` - profile content section
- `conversation-item-{conversationId}` - conversation item

## Notes
- Frontend types updated (INT-011): `Conversation.ircProfileId`, `Conversation.title`
- Backend returns `ircProfileId` in conversation list API
- No new API endpoints needed (uses existing `/conversations` list)
- localStorage key: `irc-profile-expanded` (Set of profile IDs)

## Future Enhancements
- Fetch actual profile names from `/integrations/irc/profiles` API
- Real unread count integration
- DM creation/initiation UX (Phase 2)
- Profile name editing in sidebar
