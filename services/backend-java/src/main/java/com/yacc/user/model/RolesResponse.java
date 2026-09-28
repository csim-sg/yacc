package com.yacc.user.model;

import java.util.List;

/**
 * Role-list response (frozen contract op {@code listUserRoles}).
 *
 * @param roles static role definitions
 */
public record RolesResponse(List<RoleDefinition> roles) {

    public static RolesResponse defaults() {
        return new RolesResponse(RoleDefinition.DEFINITIONS);
    }
}
