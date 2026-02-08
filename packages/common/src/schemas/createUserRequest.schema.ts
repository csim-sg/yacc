import { z } from 'zod';
import { RoleEnum } from '../constants/roles.constant.js';

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: RoleEnum,
});
