package com.yacc.conversation.model;

/**
 * Tag reference embedded in conversation views (POC parity shape
 * {@code {id, name, color}}).
 */
public record TagRef(Integer id, String name, String color) {
}
