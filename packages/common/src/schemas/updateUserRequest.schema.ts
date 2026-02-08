import { z } from 'zod';
import { RoleEnum, UserStatusEnum } from '../constants/roles.constant.js';

export const UpdateUserRequestSchema = z.object({
  role: RoleEnum.optional(),
  status: UserStatusEnum.optional(),
  password: z.string().min(8).optional(),
});
