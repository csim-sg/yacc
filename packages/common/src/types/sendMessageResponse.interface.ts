/**
 * Send Message Response
 *
 * Result from sending a message via a connector.
 * This is connector-facing (platform delivery), not API-facing.
 */

export type SendMessageResponse =
  | {
      success: true;
      platformMessageId: string;
      sentAt: string; // ISO timestamp
    }
  | {
      success: false;
      error: string;
      sentAt: string; // ISO timestamp
    };
