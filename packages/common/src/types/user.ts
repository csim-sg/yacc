/**
 * User Domain Type
 */

import type { ValueOf } from './utils';

export interface User {
  id: string;
  email: string;
  role: ValueOf<typeof ROLES>;
  status: ValueOf<typeof USER_STATUSES>;
  createdAt: string;
  updatedAt: string;
}

import { ROLES } from '../constants/roles';
import { USER_STATUSES } from '../constants/statuses';
