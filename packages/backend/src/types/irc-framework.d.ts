/**
 * Type declarations for irc-framework library
 * Provides minimal TypeScript types for IRC client operations
 * NOTE: connect() is synchronous and returns void (undefined)
 * Connection is event-driven: listen for 'registered' for successful connection
 * Ref: https://github.com/kiwiirc/irc-framework
 */

declare module 'irc-framework' {
  import { EventEmitter } from 'events';

  interface IRCClientOptions {
    host: string;
    port: number;
    nick: string;
    username?: string;
    realname?: string;
    gecos?: string;
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
    reply?(message: string): void;
  }

  interface IRCErrorEvent extends Error {
    message: string;
  }

  class Client extends EventEmitter {
    constructor();
    // connect() is synchronous and returns undefined
    // Connection success is indicated by 'registered' event
    // Connection failure is indicated by 'error' or 'close' event
    connect(options: IRCClientOptions): void;
    disconnect(message?: string, fn?: () => void): void;
    quit(message?: string): void;
    say(target: string, message: string): void;
    raw(rawString: string): void;
    join(channel: string): void;
    on(event: string, handler: (...args: unknown[]) => void): this;
    on(event: 'registered', handler: () => void): this;
    on(event: 'message', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'error', handler: (error: IRCErrorEvent) => void): this;
    on(event: 'socket close', handler: () => void): this;
    on(event: 'close', handler: () => void): this;
    on(event: 'quit', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'join', handler: (message: IRCMessageEvent) => void): this;
    on(event: 'part', handler: (message: IRCMessageEvent) => void): this;
  }

}
