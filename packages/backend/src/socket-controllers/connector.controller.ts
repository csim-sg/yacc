/**
 * Connector Socket Controller
 *
 * Handles WebSocket events for external platform integrations (Telegram, IRC)
 * Bridges connector events (message received, connection status) to WebSocket clients
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';

/**
 * Payload types for connector events
 */
type ConnectorMessageReceivedPayload = {
  conversationId: string;
  platform: 'telegram' | 'irc';
  messageId: string;
  senderId: string;
  senderName: string;
  body: string;
  timestamp: string;
  attachments?: Array<{ url: string; type: string; name: string }>;
};

type ConnectorStatusChangedPayload = {
  platform: 'telegram' | 'irc';
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  message?: string;
  timestamp: string;
};

@SocketController()
export class ConnectorController {
  /**
   * Handle incoming message from external platform (Telegram, IRC)
   * Broadcasts to conversation subscribers
   *
   * @param socket - Socket instance
   * @param payload - Message received from platform
   */
  @OnMessage('connector.message.received')
  async onConnectorMessageReceived(
    socket: Socket,
    payload: ConnectorMessageReceivedPayload
  ): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug(
        {
          conversationId: payload.conversationId,
          platform: payload.platform,
          messageId: payload.messageId,
          senderId: payload.senderId,
          room,
        },
        'Received message from external platform'
      );

      // Broadcast to all subscribers in conversation room
      socket.to(room).emit('message.received', {
        conversationId: payload.conversationId,
        platform: payload.platform,
        messageId: payload.messageId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        body: payload.body,
        timestamp: payload.timestamp,
        attachments: payload.attachments,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          conversationId: payload.conversationId,
          platform: payload.platform,
          error: errorMessage,
        },
        'Failed to broadcast connector message'
      );
      throw error;
    }
  }

  /**
   * Handle connector connection status change
   * Notifies admin/ops of connection issues
   *
   * @param socket - Socket instance
   * @param payload - Connection status update
   */
  @OnMessage('connector.status.changed')
  async onConnectorStatusChanged(
    socket: Socket,
    payload: ConnectorStatusChangedPayload
  ): Promise<void> {
    try {
      logger.debug(
        {
          platform: payload.platform,
          status: payload.status,
          message: payload.message,
        },
        'Connector status changed'
      );

      // Broadcast to admin room for monitoring
      socket.broadcast.emit('connector.status', {
        platform: payload.platform,
        status: payload.status,
        message: payload.message,
        timestamp: payload.timestamp,
      });

      // Also emit to a connector-specific room
      const room = `connector:${payload.platform}`;
      socket.broadcast.to(room).emit('status.updated', {
        status: payload.status,
        message: payload.message,
        timestamp: payload.timestamp,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          platform: payload.platform,
          error: errorMessage,
        },
        'Failed to broadcast connector status change'
      );
      throw error;
    }
  }

  /**
   * Subscribe client to connector-specific events
   * Allows ops to monitor platform health
   *
   * @param socket - Socket instance
   * @param data - Platform to monitor
   */
  @OnMessage('connector.subscribe')
  async onConnectorSubscribe(
    socket: Socket,
    data: { platform: 'telegram' | 'irc' }
  ): Promise<void> {
    const room = `connector:${data.platform}`;

    try {
      socket.join(room);
      logger.debug(
        {
          socketId: socket.id,
          platform: data.platform,
          room,
        },
        'Client subscribed to connector status updates'
      );

      // Acknowledge subscription
      socket.emit('connector.subscribed', {
        platform: data.platform,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          platform: data.platform,
          error: errorMessage,
        },
        'Failed to subscribe to connector updates'
      );
      throw error;
    }
  }

  /**
   * Unsubscribe client from connector-specific events
   *
   * @param socket - Socket instance
   * @param data - Platform to stop monitoring
   */
  @OnMessage('connector.unsubscribe')
  async onConnectorUnsubscribe(
    socket: Socket,
    data: { platform: 'telegram' | 'irc' }
  ): Promise<void> {
    const room = `connector:${data.platform}`;

    try {
      socket.leave(room);
      logger.debug(
        {
          socketId: socket.id,
          platform: data.platform,
          room,
        },
        'Client unsubscribed from connector status updates'
      );

      // Acknowledge unsubscription
      socket.emit('connector.unsubscribed', {
        platform: data.platform,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          platform: data.platform,
          error: errorMessage,
        },
        'Failed to unsubscribe from connector updates'
      );
      throw error;
    }
  }

  /**
   * Handle message send error from connector
   * Notifies user of delivery failure
   *
   * @param socket - Socket instance
   * @param payload - Send error details
   */
  @OnMessage('connector.message.error')
  async onConnectorMessageError(
    socket: Socket,
    payload: {
      conversationId: string;
      messageId: string;
      platform: 'telegram' | 'irc';
      error: string;
      willRetry: boolean;
      timestamp: string;
    }
  ): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.warn(
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          platform: payload.platform,
          error: payload.error,
          willRetry: payload.willRetry,
        },
        'Connector message send failed'
      );

      // Broadcast error to conversation subscribers
      socket.to(room).emit('message.error', {
        messageId: payload.messageId,
        error: payload.error,
        willRetry: payload.willRetry,
        timestamp: payload.timestamp,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          error: errorMessage,
        },
        'Failed to broadcast connector message error'
      );
      throw error;
    }
  }

  /**
   * Handle message acknowledgement from connector
   * Notifies user of successful delivery
   *
   * @param socket - Socket instance
   * @param payload - Send acknowledgement details
   */
  @OnMessage('connector.message.ack')
  async onConnectorMessageAck(
    socket: Socket,
    payload: {
      conversationId: string;
      messageId: string;
      platform: 'telegram' | 'irc';
      platformMessageId: string;
      timestamp: string;
    }
  ): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug(
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          platform: payload.platform,
          platformMessageId: payload.platformMessageId,
        },
        'Connector message acknowledged'
      );

      // Broadcast acknowledgement to conversation subscribers
      socket.to(room).emit('message.ack', {
        messageId: payload.messageId,
        platformMessageId: payload.platformMessageId,
        timestamp: payload.timestamp,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          error: errorMessage,
        },
        'Failed to broadcast connector message acknowledgement'
      );
      throw error;
    }
  }
}
