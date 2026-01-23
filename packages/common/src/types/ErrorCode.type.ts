import type { z } from 'zod';
import { ErrorCodeEnum } from '../constants/errors.constant';

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;
