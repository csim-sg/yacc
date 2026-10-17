package com.yacc.api.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.api.auth.AuthRefreshResponse;
import com.yacc.api.auth.AuthSessionGetResponse;
import com.yacc.api.auth.AuthSessionResponse;
import com.yacc.api.auth.AuthSignOutResponse;
import com.yacc.api.auth.AuthUser;
import com.yacc.api.auth.ChangePasswordRequest;
import com.yacc.api.auth.ForgotPasswordRequest;
import com.yacc.api.auth.MessageResponse;
import com.yacc.api.auth.RefreshTokenRequest;
import com.yacc.api.auth.ResetPasswordRequest;
import com.yacc.api.auth.SignInRequest;
import com.yacc.api.auth.SignUpRequest;
import com.yacc.api.auth.SuccessMessageResponse;
import com.yacc.api.auth.VerifyEmailRequest;
import com.yacc.service.AuthenticationService;
import com.yacc.service.EmailVerificationService;
import com.yacc.service.JwtTokenService;
import com.yacc.service.PasswordResetService;

import jakarta.validation.Valid;

/**
 * Auth wire surface (MIG-030; frozen contract §1.4 — the canonical
 * {@code /api/auth/*} endpoint map). Public: sign-in, self-registration,
 * refresh, and the MIG-031 token flows (forgot-password, reset-password,
 * verify-email). Authenticated: session lookup, sign-out, credential
 * change.
 *
 * <p>The controller is a thin translation layer — every policy decision
 * (USER-only registration, status enforcement, forced password change,
 * grant rotation, reset-token lifecycle, anti-enumeration responses) lives
 * in the auth services and the security chain. {@code /api} is declared at
 * this controller level (no global prefix, ARCH-004 §5).</p>
 */
@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    /** Constant anti-enumeration answer of forgot-password (POC parity). */
    static final String FORGOT_PASSWORD_RESPONSE =
            "If an email exists, a password reset link has been sent";

    private final AuthenticationService authenticationService;
    private final PasswordResetService passwordResetService;
    private final EmailVerificationService emailVerificationService;

    public AuthController(AuthenticationService authenticationService,
            PasswordResetService passwordResetService,
            EmailVerificationService emailVerificationService) {
        this.authenticationService = authenticationService;
        this.passwordResetService = passwordResetService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/sign-in/email")
    public AuthSessionResponse signIn(@Valid @RequestBody SignInRequest request) {
        return authenticationService.signIn(request);
    }

    @PostMapping("/sign-up/email")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthSessionResponse signUp(@Valid @RequestBody SignUpRequest request) {
        return authenticationService.signUp(request);
    }

    @PostMapping("/refresh-token")
    public AuthRefreshResponse refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        return authenticationService.refresh(request);
    }

    /**
     * Requests a password reset (frozen contract
     * {@code authForgotPassword}). Always 200 with the constant message —
     * the response is identical whether or not the address is registered
     * (anti-enumeration). Rate limited (3/h/IP).
     */
    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.initiate(request.email());
        return new MessageResponse(FORGOT_PASSWORD_RESPONSE);
    }

    /**
     * Resets the credential with the emailed token (frozen contract
     * {@code authResetPassword}). Unknown/expired/consumed tokens fail
     * generically with 400 (anti-enumeration). Rate limited (3/h/IP).
     */
    @PostMapping("/reset-password")
    public SuccessMessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.complete(request.token(), request.password());
        return new SuccessMessageResponse(true, "Password reset successfully");
    }

    /**
     * Confirms an email address with the emailed token (MIG-031; contract
     * deviation recorded in {@code openapi.yaml}). Unknown/expired/consumed
     * tokens fail generically with 400.
     */
    @PostMapping("/verify-email")
    public SuccessMessageResponse verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.confirm(request.token());
        return new SuccessMessageResponse(true, "Email verified successfully");
    }

    @PostMapping("/sign-out")
    public AuthSignOutResponse signOut(
            @AuthenticationPrincipal AuthUser principal,
            Authentication authentication) {
        return authenticationService.signOut(principal, sessionIdOf(authentication));
    }

    @GetMapping("/get-session")
    public AuthSessionGetResponse getSession(@AuthenticationPrincipal AuthUser principal) {
        return authenticationService.getSession(principal);
    }

    @PostMapping("/change-password")
    public AuthSignOutResponse changePassword(
            @AuthenticationPrincipal AuthUser principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        return authenticationService.changePassword(principal, request);
    }

    /**
     * The presented access token travels as the authentication details
     * (attached by {@code BearerTokenAuthenticationConverter}); sign-out
     * revokes the refresh grant named by its {@code sid} claim.
     */
    private static String sessionIdOf(Authentication authentication) {
        if (authentication != null
                && authentication.getDetails() instanceof Jwt accessToken) {
            return accessToken.getClaimAsString(JwtTokenService.CLAIM_SESSION_ID);
        }
        return null;
    }
}
