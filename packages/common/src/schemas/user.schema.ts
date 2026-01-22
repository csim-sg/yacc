import { z } from 'zod';
import { RoleEnum, UserStatusEnum } from '../constants/roles.constant';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleEnum,
  status: UserStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
