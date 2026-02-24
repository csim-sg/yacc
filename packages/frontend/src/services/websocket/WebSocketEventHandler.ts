/**
 * WebSocket Event Handler
 *
 * Pub/sub event handler for WebSocket events:
 * - Subscribe to event types
 * - Emit events to all subscribers
 * - Automatic cleanup
 *
 * @module @yacc/frontend/services/websocket
 */

/** Callback function type for event handlers */
export type EventCallback<T = unknown> = (payload: T) => void;

/**
 * Event Handler for WebSocket
 *
 * Manages subscriptions and emissions for WebSocket events.
 * Supports multiple subscribers per event type.
 */
export class WebSocketEventHandler {
  private handlers: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event type
   *
   * @param eventType - Event type to subscribe to
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(
    eventType: string,
    callback: EventCallback<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, callback as EventCallback);
  }

  /**
   * Unsubscribe from an event type
   *
   * @param eventType - Event type to unsubscribe from
   * @param callback - Callback function to remove
   */
  unsubscribe(eventType: string, callback: EventCallback): void {
    const callbacks = this.handlers.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   *
   * @param eventType - Event type to emit
   * @param payload - Event payload
   */
  emit(eventType: string, payload: unknown): void {
    const callbacks = this.handlers.get(eventType);
    if (!callbacks) return;

    for (const callback of callbacks) {
      this.executeHandler(callback, payload);
    }
  }

  /**
   * Unsubscribe all handlers for an event type
   *
   * @param eventType - Event type to clear (optional, clears all if not provided)
   */
  unsubscribeAll(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Execute a handler with error handling
   */
  private executeHandler(callback: EventCallback, payload: unknown): void {
    try {
      callback(payload);
    } catch (error) {
      this.handleError(error as Error, callback);
    }
  }

  /**
   * Handle handler execution errors
   */
  private handleError(error: Error, _callback: EventCallback): void {
    console.error('WebSocket handler error:', error);
    // Could emit error event here in future
  }

  /**
   * Check if there are subscribers for an event type
   *
   * @param eventType - Event type to check
   */
  hasSubscribers(eventType: string): boolean {
    const callbacks = this.handlers.get(eventType);
    return callbacks ? callbacks.size > 0 : false;
  }

  /**
   * Get subscriber count for an event type
   *
   * @param eventType - Event type to check
   */
  getSubscriberCount(eventType: string): number {
    const callbacks = this.handlers.get(eventType);
    return callbacks ? callbacks.size : 0;
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
