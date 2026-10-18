package com.yacc.api.tag;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Link-tag body (frozen contract: integer tagId ≥ 1).
 *
 * @param tagId tag to link
 */
public record AddTagBody(@NotNull @Positive Integer tagId) {
}
