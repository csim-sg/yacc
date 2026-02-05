/**
 * Connector Config Type
 *
 * Base type for connector configuration
 */

import type { Platform } from './platform.type';

export type ConnectorConfig<T extends Platform = Platform> = {
  platform: T;
  [key: string]: any;
};
