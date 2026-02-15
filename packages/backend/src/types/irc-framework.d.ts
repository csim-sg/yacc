/**
 * Type declarations for irc-framework library
 * Provides minimal TypeScript types for IRC client operations
 * Ref: https://github.com/kiwiirc/irc-framework/blob/master/docs/clientapi.md
 */

declare module 'irc-framework' {
  import { EventEmitter } from 'events';

  interface IRCClientOptions {
    host: string;
    port: number;
    nick: string;
    username?: string;
    realname?: string;
    password?: string;
    auto_reconnect?: boolean;
    auto_reconnect_max_retries?: number;
    auto_reconnect_wait?: number;
    channel_list_batch_size?: number;
    ping_interval?: number;
    [key: string]: unknown;
  }

  interface IRCMessageEvent {
    nick: string;
    ident: string;
    hostname: string;
    target: string;
    message: string;
    time?: Date;
    type?: string;
    reply(message: string): void;
  }

  class Client extends EventEmitter {
    constructor();
    connect(options: IRCClientOptions): Promise<void>;
    disconnect(message?: string, fn?: () => void): void;
    quit(message?: string): void;
    say(target: string, message: string): void;
    raw(rawString: string): void;
    join(channel: string): void;
    on(event: string, handler: (data: unknown) => void): this;
    on(event: 'registered', handler: () => void): this;
    on(event: 'message', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'error', handler: (error: Error) => void): this;
    on(event: 'socket close', handler: () => void): this;
    on(event: 'close', handler: () => void): this;
    on(event: 'quit', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'join', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'part', handler: (message: IRCMessageEvent) => void): this;
  }

  export { Client };
}
