import { attachments } from "./attachment.schema";
import { auditLogs } from "./auditLog.schema";
import { conversations } from "./conversation.schema";
import { messages } from "./message.schema";
import { notes } from "./note.schema";
import { notifications } from "./notification.schema";
import { passwordResetTokens } from "./passwordReset.schema";
import { rawPayloads } from "./rawPayload.schema";
import { routingRuleExecutions } from "./routingRule.schema";
import { tags } from "./tag.schema";
import { users } from "./user.schema";
import { session, verification, account } from "./betterAuth.schema";

export const schemas = {
  // YACC application tables
  attachments,
  auditLogs,
  conversations,
  messages,
  notes,
  notifications,
  passwordResetTokens,
  rawPayloads,
  routingRuleExecutions,
  tags,
  users,
  // BetterAuth tables (for session/account management)
  session,
  verification,
  account,
};