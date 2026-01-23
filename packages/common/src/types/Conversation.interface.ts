import type { Timestamp } from './Timestamp.interface';
import type { User } from './User.interface';
import type { Channel } from './Channel.type';
import type { ConversationStatus } from './ConversationStatus.type';
import type { Priority } from './Priority.type';
import type { Tag } from './Tag.interface';
import type { Participant } from './Participant.interface';

export interface Conversation extends Timestamp {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  tags?: Tag[];
  participants?: Participant[];
  lastMessageAt?: string;
}
