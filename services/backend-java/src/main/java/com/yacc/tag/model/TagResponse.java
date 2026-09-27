package com.yacc.tag.model;

/**
 * Wire representation of a tag (frozen contract component {@code Tag};
 * POC shape id/name/color plus creator and timestamps).
 */
public record TagResponse(
        Integer id,
        String name,
        String color,
        String createdById,
        java.time.LocalDateTime createdAt) {

    public static TagResponse from(com.yacc.tag.model.Tag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getColor(),
                tag.getCreatedById(), tag.getCreatedAt());
    }
}
