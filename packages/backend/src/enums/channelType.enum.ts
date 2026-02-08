import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Channel Type Enum - Defines supported communication platforms
 * telegram: Telegram messaging platform
 * irc: Internet Relay Chat
 * whatsapp: WhatsApp (Phase 2+)
 * wechat: WeChat (Phase 2+)
 * meta: Facebook/Instagram (Phase 2+)
 * x: Twitter/X (Phase 2+)
 * email: Email (Phase 2+)
 * slack: Slack (Phase 2+)
 */
export const channelTypeEnum = pgEnum('channel_type', [
  'telegram',
  'irc',
  'whatsapp',
  'wechat',
  'meta',
  'x',
  'email',
  'slack',
]);

export type ChannelType = typeof channelTypeEnum.enumValues[number];
