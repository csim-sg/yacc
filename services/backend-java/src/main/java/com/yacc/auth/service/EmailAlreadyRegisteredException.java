package com.yacc.auth.service;

import com.yacc.auth.model.AuthSessionResponse;

/**
 * Raised when a self-registration reuses an already-registered email
 * (MIG-030). Rendered as a generic 400 validation error — never a
 * distinct account-existence signal (anti-enumeration).
 */
public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("Validation error");
    }
}
