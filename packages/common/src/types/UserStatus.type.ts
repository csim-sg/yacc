import type { z } from 'zod';
import { UserStatusEnum } from '../constants/roles.constant';

export type UserStatus = z.infer<typeof UserStatusEnum>;
