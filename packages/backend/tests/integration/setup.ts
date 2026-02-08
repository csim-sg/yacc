/**
 * WebSocket Integration Test Setup
 *
 * Provides fixtures and utilities for testing Socket.io server
 * with real server instances, multiple clients, and event verification
 *
 * BE-206 Phase 4: Integration Testing
 */

import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIoServer, Socket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { logger } from '../../src/infrastructure/logger';
import type { WebSocketEventMap } from '../../src/types/websocket.types';

/**
 * Extended Socket type with custom user properties
 */
interface AuthenticatedSocket extends Socket {
  userId: string;
  role: string;
  email: string;
}

/**
 * Test Socket.io server configuration
 */
interface TestServerConfig {
  port?: number;
  authMiddleware?: (socket: any, next: (error?: Error) => void) => void;
}

/**
 * WebSocket test server fixture
 *
 * Creates a real Socket.io server instance for integration testing
 * Handles client connections, auth, and event verification
 */
export class WebSocketTestServer {
  private httpServer: HttpServer;
  private io: SocketIoServer;
  private port: number;
  private connectedClients: Map<string, ClientSocket> = new Map();
  private eventLog: Array<{
    event: string;
    data: any;
    timestamp: number;
    clientId?: string;
  }> = [];

  constructor(config: TestServerConfig = {}) {
    this.port = config.port || 3001;
    this.httpServer = createServer();
    this.io = new SocketIoServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 5000,
      pingInterval: 5000,
      transports: ['websocket'],
      allowUpgrades: true,
    });

    // Setup auth middleware if provided
    if (config.authMiddleware) {
      this.io.use(config.authMiddleware);
    } else {
      this.setupDefaultAuth();
    }

    this.setupConnectionHandlers();
    logger.info(`WebSocket test server configured on port ${this.port}`);
  }

  /**
   * Start the test server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        logger.info(`WebSocket test server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the test server and cleanup
   */
  async stop(): Promise<void> {
    // Disconnect all clients
    for (const client of this.connectedClients.values()) {
      if (client.connected) {
        client.disconnect();
      }
    }
    this.connectedClients.clear();

    // Close Socket.io and HTTP server
    this.io.close();
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        logger.info('WebSocket test server stopped');
        resolve();
      });
    });
  }

  /**
   * Get Socket.io server instance
   */
  getServer(): SocketIoServer {
    return this.io;
  }

  /**
   * Get HTTP server instance
   */
  getHttpServer(): HttpServer {
    return this.httpServer;
  }

  /**
   * Get server URL for clients
   */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Create and connect a test client
   */
  async connectClient(clientId: string, auth?: Record<string, any>): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Client ${clientId} failed to connect within timeout`));
      }, 5000);

      const client = ioClient(this.getUrl(), {
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionDelayMax: 500,
        reconnectionAttempts: 5,
        extraHeaders: auth ? { authorization: JSON.stringify(auth) } : {},
        auth,
      });

      client.on('connect', () => {
        clearTimeout(timeout);
        this.connectedClients.set(clientId, client);
        logger.info(`Test client ${clientId} connected (socket: ${client.id})`);
        resolve(client);
      });

      client.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Client ${clientId} connection error: ${error.message}`));
      });
    });
  }

  /**
   * Get connected client by ID
   */
  getClient(clientId: string): ClientSocket | undefined {
    return this.connectedClients.get(clientId);
  }

  /**
   * Disconnect a client
   */
  async disconnectClient(clientId: string): Promise<void> {
    const client = this.connectedClients.get(clientId);
    if (client && client.connected) {
      client.disconnect();
    }
    this.connectedClients.delete(clientId);
    logger.info(`Test client ${clientId} disconnected`);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): Map<string, ClientSocket> {
    return new Map(this.connectedClients);
  }

  /**
   * Clear event log
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * Get event log
   */
  getEventLog(): typeof this.eventLog {
    return [...this.eventLog];
  }

  /**
   * Get events filtered by event name
   */
  getEventsByName(eventName: string): typeof this.eventLog {
    return this.eventLog.filter((e) => e.event === eventName);
  }

  /**
   * Get events for specific client
   */
  getEventsForClient(clientId: string): typeof this.eventLog {
    return this.eventLog.filter((e) => e.clientId === clientId);
  }

  /**
   * Setup default authentication (accepts all connections)
   */
  private setupDefaultAuth(): void {
    this.io.use((socket: Socket, next) => {
      // Extract auth from handshake
      const auth = socket.handshake.auth || socket.handshake.headers.authorization;

      // Mock user data
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = auth?.userId || `test-user-${Math.random().toString(36).substr(2, 9)}`;
      authSocket.role = auth?.role || 'User';
      authSocket.email = auth?.email || `user-${authSocket.userId}@test.local`;

      logger.info({
        socketId: socket.id,
        userId: authSocket.userId,
        role: authSocket.role,
      }, 'WebSocket auth passed');

      next();
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info({
        socketId: socket.id,
        userId: (socket as any).userId,
      }, 'Socket connected');

      // Log all incoming events for verification
      const originalOn = socket.on.bind(socket);
      socket.on = function (event: string, ...args: any[]) {
        const handler = args[args.length - 1];
        if (typeof handler === 'function') {
          const wrappedHandler = (...handlerArgs: any[]) => {
            logger.debug(
              {
                event,
                socketId: socket.id,
                userId: (socket as any).userId,
                data: handlerArgs[0],
              },
              'Socket event received'
            );
            return handler(...handlerArgs);
          };
          args[args.length - 1] = wrappedHandler;
        }
        return originalOn(event, ...args);
      };

      // Setup client disconnection handler
      socket.on('disconnect', (reason: string) => {
        logger.info(
          {
            socketId: socket.id,
            userId: (socket as any).userId,
            reason,
          },
          'Socket disconnected'
        );
      });

      socket.on('error', (error: any) => {
        logger.error(
          {
            socketId: socket.id,
            userId: (socket as any).userId,
            error,
          },
          'Socket error'
        );
      });
    });
  }

  /**
   * Wait for event on client with timeout
   */
  async waitForEvent(
    clientId: string,
    eventName: string,
    timeout: number = 5000
  ): Promise<any> {
    const client = this.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.off(eventName);
        reject(new Error(`Timeout waiting for event ${eventName}`));
      }, timeout);

      client.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Emit event from server to all clients in room
   */
  emitToRoom(roomName: string, eventName: string, data: any): void {
    this.io.to(roomName).emit(eventName, data);
    logger.debug(
      {
        room: roomName,
        event: eventName,
        data,
      },
      'Emitted event to room'
    );
  }

  /**
   * Emit event from server to specific socket
   */
  emitToSocket(socketId: string, eventName: string, data: any): void {
    this.io.to(socketId).emit(eventName, data);
    logger.debug(
      {
        socketId,
        event: eventName,
        data,
      },
      'Emitted event to socket'
    );
  }

  /**
   * Broadcast event from server to all clients
   */
  broadcast(eventName: string, data: any): void {
    this.io.emit(eventName, data);
    logger.debug(
      {
        event: eventName,
        data,
      },
      'Broadcasted event to all clients'
    );
  }

  /**
   * Get socket by user ID
   */
  getSocketsByUserId(userId: string): Socket[] {
    const sockets: Socket[] = [];
    this.io.sockets.sockets.forEach((socket) => {
      if ((socket as any).userId === userId) {
        sockets.push(socket);
      }
    });
    return sockets;
  }

  /**
   * Get total connected socket count
   */
  getConnectedSocketCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Wait for specific number of connected clients
   */
  async waitForConnectedClients(count: number, timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.getConnectedSocketCount() >= count) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(
            new Error(
              `Timeout waiting for ${count} connected clients. Got ${this.getConnectedSocketCount()}`
            )
          );
        }
      }, 100);
    });
  }
}

/**
 * Create a test server instance
 */
export async function createTestWebSocketServer(
  config?: TestServerConfig
): Promise<WebSocketTestServer> {
  const server = new WebSocketTestServer(config);
  await server.start();
  return server;
}

/**
 * Helper: Subscribe client to conversation room
 */
export async function subscribeToConversation(
  client: ClientSocket,
  conversationId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout subscribing to conversation ${conversationId}`));
    }, 5000);

    client.emit('conversation:subscribe', { conversationId }, (response: any) => {
      clearTimeout(timeout);
      if (response?.ok) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Helper: Unsubscribe client from conversation room
 */
export async function unsubscribeFromConversation(
  client: ClientSocket,
  conversationId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout unsubscribing from conversation ${conversationId}`));
    }, 5000);

    client.emit('conversation:unsubscribe', { conversationId }, (response: any) => {
      clearTimeout(timeout);
      if (response?.ok) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Helper: Wait for room event on all clients in room
 */
export async function waitForRoomEvent(
  server: WebSocketTestServer,
  clientIds: string[],
  eventName: string,
  timeout: number = 5000
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  const promises = clientIds.map((clientId) =>
    server.waitForEvent(clientId, eventName, timeout).then(
      (data) => results.set(clientId, data),
      (error) => {
        throw new Error(`Client ${clientId}: ${error.message}`);
      }
    )
  );

  await Promise.all(promises);
  return results;
}

/**
 * Cleanup helper: Stop all clients and server
 */
export async function cleanupTestServer(server: WebSocketTestServer): Promise<void> {
  await server.stop();
}
