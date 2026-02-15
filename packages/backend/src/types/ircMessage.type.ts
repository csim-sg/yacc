/**
 * IRC Framework Message Type
 * Represents an incoming IRC message
 * Matches irc-framework IRCMessageEvent interface
 */
export type IRCFrameworkMessage = {
  nick: string;
  ident: string;
  hostname: string;
  target: string; // channel or direct message target
  message: string; // Note: irc-framework uses 'message', not 'text'
  time?: Date;
  type?: string;
  reply?(message: string): void;
};

/**
 * IRC Framework Error Type
 * Represents an IRC error
 */
export type IRCFrameworkError = Error & {
  message: string;
};
