import type { z } from 'zod';
import { ChannelEnum } from '../constants/statuses.constant';

export type Channel = z.infer<typeof ChannelEnum>;
