package com.yacc.tag.model;

import java.util.List;

import com.yacc.conversation.model.TagRef;

/**
 * POC {@code {tags: [...]}} holder.
 *
 * @param tags the conversation's tags
 */
public record TagsWrapper(List<TagRef> tags) {
}
