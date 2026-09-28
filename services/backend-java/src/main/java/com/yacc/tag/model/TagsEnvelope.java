package com.yacc.tag.model;

import java.util.List;

/**
 * Tag-list envelope {@code {data: [Tag]}}.
 *
 * @param data the tags
 */
public record TagsEnvelope(List<TagResponse> data) {
}
