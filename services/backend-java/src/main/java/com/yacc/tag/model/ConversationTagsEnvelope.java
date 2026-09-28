package com.yacc.tag.model;

import com.yacc.conversation.model.TagRef;

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
