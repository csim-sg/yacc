# Types Directory Usage Report

## Summary
Total files remaining: 13
- These files are core domain types and base interfaces
- Should NOT be deleted unless confirmed they are unused

## Files and Their Purpose

### Core Domain Types (Should Stay)
1. **searchableRequest.type.ts** - Base interface for search queries (ISearchableRequest)
   - Status: ✅ IN USE - Found in requests/listConversations.request.ts, audit/getConversationAuditLogs.request.ts, etc.
   - Action: KEEP - This is a critical base interface used by multiple request classes

2. **listResponse.type.ts** - Base interface for list responses (IListResponse)
   - Status: ✅ IN USE - Found in responses/conversations/conversation.response.ts
   - Action: KEEP - This is a critical base interface used by all list response types

3. **notification.interface.ts** - Core notification type
   - Status: TO CHECK
   - Action: Check if imported anywhere

4. **notificationType.type.ts** - Notification enum type
   - Status: TO CHECK
   - Action: Check if imported anywhere

5. **routingRule.interface.ts** - Core routing rule type
   - Status: TO CHECK
   - Action: Check if imported anywhere

6. **conversation.interface.ts** - Core conversation type
   - Status: TO CHECK
   - Action: Check if imported anywhere

7. **message.interface.ts** - Core message type
   - Status: TO CHECK
   - Action: Check if imported anywhere

8. **user.interface.ts** - Core user type
   - Status: TO CHECK
   - Action: Check if imported anywhere

9. **note.interface.ts** - Core note type
   - Status: TO CHECK
   - Action: Check if imported anywhere

### Connector Infrastructure Types (Should Stay)
10. **platform.type.ts** - Platform enum/type
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

11. **connectorConfig.type.ts** - Connector configuration type
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

12. **connectorStatus.type.ts** - Connector status enum
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

13. **connectorMessage.interface.ts** - Connector message interface
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

14. **connectorEventMap.type.ts** - Connector event map type
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

15. **connectionInfo.interface.ts** - Connection info interface
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

16. **connectionError.class.ts** - Connection error class
    - Status: TO CHECK
    - Action: Check if imported in backend connectors

## Investigation Needed

### Files to Check Usage For:
- notificationType.type.ts (enum)
- routingRule.interface.ts
- conversation.interface.ts
- message.interface.ts
- user.interface.ts
- note.interface.ts
- All connector infrastructure types (platform, connectorConfig, connectorStatus, connectorMessage, connectorEventMap, connectionInfo, connectionError)

### Files Clearly in Use (Do NOT Delete):
- ✅ searchableRequest.type.ts - Used by multiple request classes
- ✅ listResponse.type.ts - Used by multiple response types

### Recommendation
1. Do NOT delete any of the 13 remaining files without thorough investigation
2. These are core domain types that may be imported in backend/frontend
3. Search backend/src/ and frontend/src/ for imports before deleting
4. Create comprehensive import mapping report
