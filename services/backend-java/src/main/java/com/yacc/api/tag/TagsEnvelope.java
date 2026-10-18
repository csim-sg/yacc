package com.yacc.api.tag;

import java.util.List;

/**
 * Tag-list envelope {@code {data: [Tag]}}.
 *
 * @param data the tags
 */
public record TagsEnvelope(List<TagResponse> data) {
}
