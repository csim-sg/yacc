# Pending UI Requirements

## Company Concept
- All users belong to a single Company.
- Company is a top-level context in the UI and settings.

Implications
- Role-based access and permissions may need to be scoped by Company.
- UI copy should reference Company consistently (not workspace/team unless renamed).

Questions
- Is Company fixed for the single-tenant MVP or configurable in settings?
- Should Company name/logo appear in the global header or only in Settings?

## Account Info Placement
- Move account information from the Inbox page to Settings under a new Company section.

Implications
- Inbox layout should be simplified and free of account details.
- Settings IA needs a Company section with account details surfaced there.

Questions
- Which specific account fields should appear in Company settings (name, plan, billing, admins)?
- Are users’ personal profile settings separate from Company settings?

## Channels Behavior (Telegram)
- Clicking Telegram switches main window to an AI chat-style layout.
- Layout requirements:
  - Left column: conversation history + channel/DM list.
  - Main area: conversation details for the selected item.
  - Right column: if conversation is IRC channel, Telegram channel, or Telegram group, show list of all users in the group.

Implications
- Distinct layout mode for Telegram vs default inbox view.
- Conversation list and message history need to coexist in the left column.
- Right column participant list is conditional by conversation type.

Questions
- Should the AI chat-style layout apply only to Telegram, or also to IRC?
- How does navigation return from AI chat layout to standard inbox view?
- For DMs, should the right column be hidden or replaced with user profile info?
- What is the source of group member lists (API endpoint and permissions)?

## Activity Timeline (Conversation Detail)
- Timeline includes messages plus system events for assignments, tags, status changes, and internal notes.
- Timeline is in strict chronological order across all item types.
- Status control lives in the conversation header.
- Assignment, tags, and internal notes controls live in the right panel/actions panel.

Acceptance Criteria
- Notes are internal-only and show author + timestamp.
- Assignment, tag, and status changes are logged and appear in the timeline.
- Assignee and @mention notifications are triggered for relevant actions.
- Auto-reopen displays an explicit reason in the UI.

Implications
- Timeline rendering needs consistent visual hierarchy for messages and system events.
- Conversation header must accommodate status controls without crowding primary metadata.
- Right panel/actions panel must handle assignment, tag, and note creation without obscuring timeline.

Questions
- What is the intended styling and iconography for timeline item types?
- Should system events show actor attribution when available, and how is it displayed?
- Should the timeline support grouping or collapsing (e.g., system events)?
- Is there a single combined timeline or split tabs for messages vs events?

Future Enhancements
- Auto-reopen logic on new inbound messages should be implemented in backend.
