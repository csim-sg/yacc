import type { Platform } from './Platform.type';

export type ConnectorConfig<T extends Platform = Platform> = {
  platform: T;
} & Record<string, unknown>;
