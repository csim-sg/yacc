package com.yacc.auth.model;

import java.util.List;

/**
 * One page of directory results.
 *
 * @param users page items
 * @param total matching identities across all pages
 */
public record UserPage(List<User> users, long total) {
}
