/**
 * Note Domain Type
 */

export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}
