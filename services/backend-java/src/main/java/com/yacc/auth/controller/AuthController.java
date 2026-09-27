package com.yacc.auth.controller;

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

import com.yacc.auth.model.AuthRefreshResponse;
import com.yacc.auth.model.AuthSessionGetResponse;
import com.yacc.auth.model.AuthSessionResponse;
import com.yacc.auth.model.AuthSignOutResponse;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.ChangePasswordRequest;
import com.yacc.auth.model.RefreshTokenRequest;
import com.yacc.auth.model.SignInRequest;
import com.yacc.auth.model.SignUpRequest;
import com.yacc.auth.service.AuthenticationService;
import com.yacc.auth.service.JwtTokenService;

import jakarta.validation.Valid;

/**
 * Auth wire surface (MIG-030; frozen contract §1.4 — the canonical
 * {@code /api/auth/*} endpoint map). Public: sign-in, self-registration,
 * refresh. Authenticated: session lookup, sign-out, credential change.
 *
 * <p>The controller is a thin translation layer — every policy decision
 * (USER-only registration, status enforcement, forced password change,
 * grant rotation) lives in {@link AuthenticationService} and the security
 * chain. {@code /api} is declared at this controller level (no global
 * prefix, ARCH-004 §5).</p>
 */
@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final AuthenticationService authenticationService;

    public AuthController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
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
