/**
 * AuthenticatedSocket
 *
 * Type-safe Socket.io socket with user authentication context.
 * Extends Socket with userId and userRole for proper TypeScript support.
 */

import type { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: 'super_admin' | 'admin' | 'manager' | 'user';
}
