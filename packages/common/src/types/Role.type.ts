import type { z } from 'zod';
import { RoleEnum } from '../constants/roles.constant';

export type Role = z.infer<typeof RoleEnum>;
