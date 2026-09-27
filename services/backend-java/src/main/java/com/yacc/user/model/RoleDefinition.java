package com.yacc.user.model;

import java.util.List;

/**
 * One static role definition (frozen contract op {@code listUserRoles}).
 *
 * @param id lowercase wire role
 * @param label human-readable label
 * @param description role purpose
 * @param permissions permission keys of the role
 */
public record RoleDefinition(String id, String label, String description, List<String> permissions) {

    /** The frozen 4-role matrix (POC parity, ledger row REST-USER-005). */
    public static final List<RoleDefinition> DEFINITIONS = List.of(
            new RoleDefinition("super_admin", "Super Admin",
                    "Full system access - user management, integrations, rules",
                    List.of("users.read", "users.create", "users.update", "users.delete",
                            "integrations.crud", "rules.crud", "audit.read")),
            new RoleDefinition("admin", "Admin",
                    "Operations and inbox management",
                    List.of("conversations.read", "conversations.update", "messages.send",
                            "messages.reply", "assignments.manage", "tags.manage", "rules.read")),
            new RoleDefinition("manager", "Manager",
                    "Oversight and audit access",
                    List.of("conversations.read", "audit.read", "analytics.read")),
            new RoleDefinition("user", "User",
                    "Handle messages and conversations",
                    List.of("conversations.read", "messages.reply", "assignments.view")));
}
