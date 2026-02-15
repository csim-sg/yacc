/**
 * IRC Framework Message Type
 * Represents an incoming IRC message
 */
export type IRCFrameworkMessage = {
  nick: string;
  ident: string;
  hostname: string;
  target: string; // channel or direct message target
  text: string;
  time?: Date;
  type?: string;
};

/**
 * IRC Framework Error Type
 * Represents an IRC error
 */
export type IRCFrameworkError = Error & {
  message: string;
};
