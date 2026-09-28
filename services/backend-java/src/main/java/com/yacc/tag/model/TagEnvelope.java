package com.yacc.tag.model;

/**
 * Single-tag envelope {@code {data: Tag}}.
 *
 * @param data the tag
 */
public record TagEnvelope(TagResponse data) {
}
