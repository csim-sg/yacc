package com.yacc.api.auth;

import com.yacc.entity.User;
import java.util.List;

/**
 * One page of directory results.
 *
 * @param users page items
 * @param total matching identities across all pages
 */
public record UserPage(List<User> users, long total) {
}
