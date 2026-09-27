package com.yacc.auth.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.model.AuthSessionGetResponse;
import com.yacc.auth.model.AuthSessionResponse;
import com.yacc.auth.model.AuthSignOutResponse;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.AuthRefreshResponse;
import com.yacc.auth.model.ChangePasswordRequest;
import com.yacc.auth.model.RefreshTokenRequest;
import com.yacc.auth.model.Session;
import com.yacc.auth.model.SignInRequest;
import com.yacc.auth.model.SignUpRequest;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserResponse;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Local authentication flows (MIG-030; ADR-025): sign-in, self-registration,
 * session lookup, refresh-grant rotation, sign-out, and the forced password
 * change. Fixed founder policy lives here, not in callers:
 *
 * <ul>
 *   <li>self-registration always creates {@code role: user} — the request
 *       carries no role field, so elevation by wire is impossible;</li>
 *   <li>inactive/suspended accounts cannot authenticate (sign-in and every
 *       downstream token use are denied);</li>
 *   <li>bootstrap/recovery identities keep the forced-password-change flag
 *       until the credential is replaced, which revokes every refresh
 *       grant;</li>
 *   <li>sign-in success/failure and credential replacement are audit-logged
 *       (POC action vocabulary via Spring Security events + audit hook).</li>
 * </ul>
 */
@Service
public class AuthenticationService {

    private final UserRepository users;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessions;
    private final JwtTokenService tokens;
    private final ApplicationEventPublisher events;
    private final AuditPersistence audit;
    private final EmailVerificationService emailVerification;

    public AuthenticationService(
            UserRepository users,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            SessionService sessions,
            JwtTokenService tokens,
            ApplicationEventPublisher events,
            AuditPersistence audit,
            EmailVerificationService emailVerification) {
        this.users = users;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
        this.tokens = tokens;
        this.events = events;
        this.audit = audit;
        this.emailVerification = emailVerification;
    }

    /**
     * Signs in with email + password (frozen contract {@code authSignInEmail}).
     * Uniform {@link BadCredentialsException} (401) for unknown accounts,
     * wrong credentials, and non-active identities — no enumeration.
     *
     * @param request sign-in body
     * @return session response with tokens and the forced-change signal
     */
    @Transactional
    public AuthSessionResponse signIn(SignInRequest request) {
        try {
            org.springframework.security.core.Authentication result = authenticationManager
                    .authenticate(new UsernamePasswordAuthenticationToken(
                            request.email(), request.password()));
            AuthUser principal = (AuthUser) result.getPrincipal();
            events.publishEvent(new org.springframework.security.authentication.event.AuthenticationSuccessEvent(result));

            User user = principal.user();
            user.setLastLoginAt(java.time.LocalDateTime.now());
            user.setUpdatedAt(java.time.LocalDateTime.now());
            user = users.save(user);

            Session session = sessions.issue(user);
            String accessToken = tokens.issueAccessToken(new AuthUser(user), session.getId());
            return new AuthSessionResponse(UserResponse.from(user), accessToken,
                    session.getToken(), user.isMustChangePassword());
        } catch (AuthenticationException failure) {
            events.publishEvent(
                    new org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent(
                            new UsernamePasswordAuthenticationToken(request.email(), "N/A"),
                            failure));
            throw new BadCredentialsException("Invalid credentials", failure);
        }
    }

    /**
     * Registers an ordinary user (frozen contract {@code authSignUpEmail}).
     * The created identity is always {@code role: user} with {@code active}
     * status — self-elevation is impossible; privileged provisioning stays
     * SUPER_ADMIN-only (tech-lead guardrail). A duplicate email fails with a
     * generic validation error (anti-enumeration). The email-verification
     * challenge is issued on registration (MIG-031) — delivery retries and
     * audits without failing sign-up.
     *
     * @param request registration body (email, password, name — no role)
     * @return session response for the new {@code user}-role identity
     */
    @Transactional
    public AuthSessionResponse signUp(SignUpRequest request) {
        if (users.findByEmail(request.email()).isPresent()) {
            throw new EmailAlreadyRegisteredException();
        }
        User created = new User(
                java.util.UUID.randomUUID().toString(),
                request.email(),
                request.name(),
                passwordEncoder.encode(request.password()),
                UserRole.USER,
                UserStatus.ACTIVE,
                false);
        created = users.save(created);
        audit.persist(new AuditRecord("user.registered", "user", created.getId(),
                created.getId(), null, java.time.Instant.now()));
        emailVerification.issue(created);

        Session session = sessions.issue(created);
        String accessToken = tokens.issueAccessToken(new AuthUser(created), session.getId());
        return new AuthSessionResponse(UserResponse.from(created), accessToken,
                session.getToken(), false);
    }

    /**
     * Rotates the presented refresh grant (frozen contract
     * {@code authRefreshToken}). Unknown, expired, and revoked grants fail
     * uniformly with {@link BadCredentialsException} (401); non-active
     * owners are denied (status enforcement on the integration point).
     *
     * @param request body with the presented refresh grant
     * @return the rotated token pair
     */
    @Transactional
    public AuthRefreshResponse refresh(RefreshTokenRequest request) {
        Session presented = sessions.findValid(request.refreshToken())
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh grant"));
        User user = users.findById(presented.getUserId())
                .filter(candidate -> candidate.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh grant"));
        Session rotated = sessions.rotate(presented, user);
        String accessToken = tokens.issueAccessToken(new AuthUser(user), rotated.getId());
        return new AuthRefreshResponse(accessToken, rotated.getToken());
    }

    /**
     * Revokes the refresh grant named by the presented access token's
     * {@code sid} claim (frozen contract {@code authSignOut}). Idempotent;
     * the stateless access token simply expires (ADR-025).
     *
     * @param principal authenticated identity
     * @param sessionId access-token {@code sid} claim
     * @return success acknowledgment
     */
    @Transactional
    public AuthSignOutResponse signOut(AuthUser principal, String sessionId) {
        if (sessionId != null) {
            sessions.revoke(sessionId, principal.getId());
        }
        return new AuthSignOutResponse(true);
    }

    /**
     * Resolves the current identity (frozen contract {@code authGetSession}).
     *
     * @param principal authenticated identity (loaded fresh per request)
     * @return the canonical user object with the forced-change signal
     */
    @Transactional(readOnly = true)
    public AuthSessionGetResponse getSession(AuthUser principal) {
        return new AuthSessionGetResponse(UserResponse.from(principal.user()),
                principal.isMustChangePassword());
    }

    /**
     * Replaces the credential and clears the forced-password-change flag
     * (ADR-025 bootstrap/recovery contract). The current password is
     * verified first; every refresh grant of the identity is revoked so
     * other clients must re-authenticate.
     *
     * @param principal authenticated identity
     * @param request   current + replacement credential
     * @return success acknowledgment
     * @throws BadCredentialsException when the current password is wrong
     */
    @Transactional
    public AuthSignOutResponse changePassword(AuthUser principal, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(),
                principal.user().getPasswordHash())) {
            throw new BadCredentialsException("Current password is incorrect");
        }
        User user = principal.user();
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        user.setUpdatedAt(java.time.LocalDateTime.now());
        users.save(user);
        sessions.revokeAllForUser(user.getId());
        audit.persist(new AuditRecord("user.password_changed", "user", user.getId(),
                user.getId(), null, java.time.Instant.now()));
        return new AuthSignOutResponse(true);
    }
}
