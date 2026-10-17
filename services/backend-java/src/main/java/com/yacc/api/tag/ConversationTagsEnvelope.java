package com.yacc.api.tag;

import com.yacc.api.conversation.TagRef;

/**
 * Conversation-tags envelope {@code {data: {tags: [...]}}} (POC parity
 * for link/unlink results; contract `data` is a loose object).
 *
 * @param data wrapper holding the conversation's tags
 */
public record ConversationTagsEnvelope(TagsWrapper data) {

    public ConversationTagsEnvelope(java.util.List<TagRef> tags) {
        this(new TagsWrapper(tags));
    }
}
