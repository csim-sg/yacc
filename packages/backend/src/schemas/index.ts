import { attachments } from "./attachment.schema";
import { auditLogs } from "./auditLog.schema";
import { conversations } from "./conversation.schema";
import { messages } from "./message.schema";
import { notes } from "./note.schema";
import { notifications } from "./notification.schema";
import { passwordResetTokens } from "./passwordReset.schema";
import { rawPayloads } from "./rawPayload.schema";
import { routingRules } from "./routingRule.schema";
import { routingRuleExecutions } from "./routingRuleExecution.schema";
import { tags } from "./tag.schema";
import { conversationTags } from "./conversationTag.schema";
import { users } from "./user.schema";
import { session } from "./session.schema";
import { verification } from "./verification.schema";
import { account } from "./account.schema";

/**
 * Schema registry - data-only constant for library wiring (Drizzle adapter)
 * Direct file imports required; no barrel exports allowed
 */
export const schemas = {
  // YACC application tables
  attachments,
  auditLogs,
  conversations,
  conversationTags,
  messages,
  notes,
  notifications,
  passwordResetTokens,
  rawPayloads,
  routingRules,
  routingRuleExecutions,
  tags,
  users,
  // BetterAuth tables (for session/account management)
  session,
  verification,
  account,
};
