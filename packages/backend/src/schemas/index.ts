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

export const schemas = {
  // Add your schemas here as you create them
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
  users
};