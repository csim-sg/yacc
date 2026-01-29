/**
 * WebSocket Authentication Middleware
 *
 * Authenticates WebSocket connections using BetterAuth session tokens
 * Validates sessions and attaches user info to socket
 */

import { Socket } from 'socket.io';
import { BetterAuthClient } from '../infrastructure/better-auth.client';
import { Database } from '../infrastructure/db.client';
import { users } from '../infrastructure/db.schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../infrastructure/logger';
import { config } from '../config/config';

// Initialize logger instance
const logger = new Logger(config.logging);

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
 */
const getAuthInstance = (): any => {
  const betterAuthClient = new BetterAuthClient(
    {} as any, // Will be initialized with drizzle from Database
    { users: users, session: users, verification: users, account: users },
    config.auth
  );
  return betterAuthClient.getAuth();
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
      logger.getLogger().warn({ socketId: socket.id }, 'WebSocket connection rejected: No token provided');
      return next(new Error('Authentication token required'));
    }

    // Validate session with BetterAuth
    const auth = getAuthInstance();
    const session = await auth.api.getSession({
      headers: socket.handshake.headers as any,
    });

    if (!session) {
      logger.getLogger().warn({ socketId: socket.id }, 'WebSocket connection rejected: Invalid session');
      return next(new Error('Invalid session token'));
    }

    // Fetch full user from database to get role and status
    const userId = session.user.id as string;
    const db = new Database({ url: config.database.url });
    const drizzle = db.getDrizzle();
    const user = await drizzle.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      logger.getLogger().warn({ socketId: socket.id, userId }, 'WebSocket connection rejected: User not found');
      return next(new Error('User not found'));
    }

    // Check user status - inactive or suspended users cannot connect
    if (user.status === 'inactive' || user.status === 'suspended') {
      logger.getLogger().warn({ socketId: socket.id, status: user.status }, 'WebSocket connection rejected: Inactive/suspended user');
      return next(new Error('User account is inactive or suspended'));
    }

    // Attach user info to socket for use in event handlers
    (socket as AuthenticatedSocket).userId = user.id;
    (socket as AuthenticatedSocket).email = user.email;
    (socket as AuthenticatedSocket).role = user.role;
    (socket as AuthenticatedSocket).name = user.name;

    logger.getLogger().info({
      socketId: socket.id,
      userId: user.id,
      role: user.role,
    }, 'WebSocket connection authenticated');

    next();
  } catch (error) {
    logger.getLogger().error({ socketId: socket.id, error: 'Failed to authenticate WebSocket connection', error });
    next(new Error('Authentication failed'));
  }
}

export type { AuthenticatedSocket };
