/**
 * WebSocket Authentication Middleware
 *
 * Authenticates WebSocket connections using BetterAuth session tokens
 * Validates sessions and attaches user info to socket
 */

import { Socket } from 'socket.io';
import { dbClient } from '../infrastructure/db.client';
import { users } from '../infrastructure/db.schema';
import { eq } from 'drizzle-orm';
import { logger } from '../infrastructure/logger';
import { config } from '../config/config';
import type { BetterAuthClient } from '../infrastructure/better-auth.client';

/**
 * Extended Socket interface with authenticated user
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
}

/**
 * Get BetterAuth instance
 * TODO: Implement proper BetterAuth client initialization
 * @deprecated This function is a placeholder and not yet implemented
 */
const getAuthInstance = (): any => {
   // TODO: Implement BetterAuth client initialization
   // Requires proper authentication infrastructure setup
   return null as any;
};

/**
 * WebSocket authentication middleware
 *
 * Validates BetterAuth session token from handshake auth query param
 * Attaches user info to socket if authenticated
 */
export async function webSocketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    // Extract session token from handshake auth query param
    const token = socket.handshake.auth.token;

     if (!token) {
       logger.warn('WebSocket connection rejected: No token provided with socketId: %s', socket.id);
       return next(new Error('Authentication token required'));
     }

     // Validate session with BetterAuth
     const auth = getAuthInstance();
     const session = await auth.api.getSession({
       headers: socket.handshake.headers as any,
     });

     if (!session) {
       logger.warn('WebSocket connection rejected: Invalid session with socketId: %s', socket.id);
       return next(new Error('Invalid session token'));
     }

     // Fetch full user from database to get role and status
     const userId = session.user.id as string;
     const dbClient = dbClient as any; // TODO: Fix type
     const drizzle = dbClient;
     const user = await drizzle.query.users.findFirst({
       where: eq(users.id, userId),
     });

     if (!user) {
       logger.warn('WebSocket connection rejected: User not found with socketId: %s, userId: %s', socket.id, userId);
       return next(new Error('User not found'));
     }

     // Check user status - inactive or suspended users cannot connect
     if (user.status === 'inactive' || user.status === 'suspended') {
       logger.warn('WebSocket connection rejected: Inactive/suspended user with socketId: %s, status: %s', socket.id, user.status);
       return next(new Error('User account is inactive or suspended'));
     }

     // Attach user info to socket for use in event handlers
     (socket as AuthenticatedSocket).userId = user.id;
     (socket as AuthenticatedSocket).email = user.email;
     (socket as AuthenticatedSocket).role = user.role;
     (socket as AuthenticatedSocket).name = user.name;

     logger.info('WebSocket connection authenticated - socketId: %s, userId: %s, role: %s', socket.id, user.id, user.role);

     next();
   } catch (error) {
     logger.error('WebSocket authentication failed - socketId: %s, error: %s', socket.id, error instanceof Error ? error.message : String(error));
     next(new Error('Authentication failed'));
   }
}

export type { AuthenticatedSocket };
