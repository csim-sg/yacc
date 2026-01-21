/**
 * Supported Communication Channels
 */

export const CHANNELS = {
  TELEGRAM: 'telegram',
  IRC: 'irc',
  WHATSAPP: 'whatsapp',
  TWITTER: 'twitter',
} as const;

export const CHANNEL_NAMES: Record<string, string> = {
  telegram: 'Telegram',
  irc: 'IRC',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter/X',
};

export const MVP_CHANNELS = ['telegram', 'irc'] as const;

export const PHASE_2_CHANNELS = ['whatsapp', 'twitter'] as const;
