package com.yacc.api.tag;

/**
 * Single-tag envelope {@code {data: Tag}}.
 *
 * @param data the tag
 */
public record TagEnvelope(TagResponse data) {
}
