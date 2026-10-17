package com.yacc.api.tag;

import java.util.List;

import com.yacc.api.conversation.TagRef;

/**
 * POC {@code {tags: [...]}} holder.
 *
 * @param tags the conversation's tags
 */
public record TagsWrapper(List<TagRef> tags) {
}
