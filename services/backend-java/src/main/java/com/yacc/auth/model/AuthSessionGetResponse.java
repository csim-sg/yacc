package com.yacc.auth.model;

/**
 * Session-lookup response (MIG-030; frozen contract
 * {@code AuthSessionGetResponse}): the user resolved from the presented
 * Bearer access token — no server-side session object exists (ADR-025
 * stateless default).
 *
 * <p>{@code mustChangePassword} is part of the documented MIG-030
 * contract-change finding (see {@link AuthSessionResponse}).</p>
 *
 * @param user               canonical user object
 * @param mustChangePassword true when the identity must replace its credential
 */
public record AuthSessionGetResponse(UserResponse user, boolean mustChangePassword) {
}
