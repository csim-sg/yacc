package com.yacc.auth.model;

/**
 * Sign-in / self-registration response (MIG-030; frozen contract
 * {@code AuthSessionResponse}): the canonical user object plus the stateless
 * JWT access token and the refresh grant.
 *
 * <p>{@code mustChangePassword} is the documented MIG-030 contract-change
 * finding (contract-canonicalization §1.5): it signals the ADR-025
 * forced-password-change state of the bootstrap/recovery identity so the
 * client (MIG-034) can drive the credential replacement.</p>
 *
 * @param user               canonical user object
 * @param accessToken        stateless JWT access token
 * @param refreshToken       opaque refresh grant (rotated on use)
 * @param mustChangePassword true when the identity must replace its credential
 */
public record AuthSessionResponse(
        UserResponse user,
        String accessToken,
        String refreshToken,
        boolean mustChangePassword) {
}
