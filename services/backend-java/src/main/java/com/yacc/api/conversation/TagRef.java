package com.yacc.api.conversation;

/**
 * Tag reference embedded in conversation views (POC parity shape
 * {@code {id, name, color}}).
 */
public record TagRef(Integer id, String name, String color) {
}
