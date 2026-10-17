package com.yacc.api.tag;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Create-tag body (frozen contract component {@code CreateTagBody}; GOV-021
 * — any authenticated role may create tags).
 *
 * @param name unique tag name (1..255)
 * @param color optional {@code #RRGGBB} hex color
 */
public record CreateTagRequest(
        @NotBlank @Size(max = 255) String name,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex color code (e.g., #FF5A5F)")
        // Contract CreateTagBody.color: optional, non-nullable — omitted when
        // absent, never null (MIG-102).
        @JsonInclude(JsonInclude.Include.NON_NULL) String color) {
}
