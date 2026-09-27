package com.yacc.integration.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.integration.model.ProfileResponse;
import com.yacc.integration.model.ProfileTestResult;
import com.yacc.integration.model.ProfileWrite;
import com.yacc.integration.service.IrcProfileService;

import jakarta.validation.Valid;

/**
 * IRC profile wire surface (ledger rows REST-IRCPROF-001..008; frozen
 * contract ops {@code createIrcProfile}, {@code listIrcProfiles},
 * {@code getIrcProfile}, {@code updateIrcProfile}, {@code activateIrcProfile},
 * {@code disableIrcProfile}, {@code deleteIrcProfile},
 * {@code testIrcProfileConnection}): super_admin writes; admin/manager
 * reads; responses never carry secrets.
 */
@RestController
@RequestMapping("/api/integrations/irc/profiles")
public class IrcProfileController {

    /** Default single-tenant id (POC parity). */
    private static final String DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

    private final IrcProfileService profiles;

    public IrcProfileController(IrcProfileService profiles) {
        this.profiles = profiles;
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileResponse create(@Valid @RequestBody ProfileWrite request,
            @AuthenticationPrincipal AuthUser principal) {
        return profiles.create(DEFAULT_TENANT_ID, request, principal.getId());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public java.util.List<ProfileResponse> list() {
        return profiles.list(DEFAULT_TENANT_ID);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public ProfileResponse get(@PathVariable("id") int id) {
        return profiles.get(DEFAULT_TENANT_ID, id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ProfileResponse update(@PathVariable("id") int id,
            @Valid @RequestBody ProfileWrite request,
            @AuthenticationPrincipal AuthUser principal) {
        return profiles.update(DEFAULT_TENANT_ID, id, request, principal.getId());
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ProfileResponse activate(@PathVariable("id") int id,
            @AuthenticationPrincipal AuthUser principal) {
        return profiles.activate(DEFAULT_TENANT_ID, id, principal.getId());
    }

    @PostMapping("/{id}/disable")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ProfileResponse disable(@PathVariable("id") int id,
            @AuthenticationPrincipal AuthUser principal) {
        return profiles.disable(DEFAULT_TENANT_ID, id, principal.getId());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") int id,
            @AuthenticationPrincipal AuthUser principal) {
        profiles.delete(DEFAULT_TENANT_ID, id, principal.getId());
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ProfileTestResult test(@PathVariable("id") int id) {
        return profiles.test(DEFAULT_TENANT_ID, id);
    }
}
