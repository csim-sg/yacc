/**
 * User Domain Type
 */

export interface User {
  id: string;
  email: string;
  role: keyof typeof ROLES;
  status: keyof typeof USER_STATUSES;
  createdAt: string;
  updatedAt: string;
}

import { ROLES } from '../constants/roles';
import { USER_STATUSES } from '../constants/statuses';
