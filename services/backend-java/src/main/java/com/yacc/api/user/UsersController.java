package com.yacc.api.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.api.auth.UserResponse;
import com.yacc.entity.UserStatus;
import com.yacc.common.model.BaseListResponse;
import com.yacc.api.user.CreateUserRequest;
import com.yacc.api.user.CreateUserResponse;
import com.yacc.api.user.DeleteUserResponse;
import com.yacc.api.user.RolesResponse;
import com.yacc.api.user.UpdateUserRequest;
import com.yacc.api.user.UpdateUserResponse;
import com.yacc.api.user.UserAdminService;

import jakarta.validation.Valid;

/**
 * User-management wire surface (ledger rows REST-USER-001..005; frozen
 * contract ops {@code listUsers}, {@code createUser}, {@code updateUser},
 * {@code deleteUser}, {@code listUserRoles}). CRUD is super_admin-only;
 * the role matrix is readable by any authenticated user. {@code /api} is
 * declared at this controller level (no global prefix, ARCH-004 §5).
 */
@RestController
@RequestMapping("/api/users")
@Validated
public class UsersController {

    private final UserAdminService users;

    public UsersController(UserAdminService users) {
        this.users = users;
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public BaseListResponse<UserResponse> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal AuthUser principal) {
        int effectivePage = page == null ? 1 : page;
        int effectiveLimit = limit == null ? 20 : limit;
        var result = users.list(effectivePage, effectiveLimit, role, status, search,
                principal.user());
        return BaseListResponse.of(
                result.users().stream().map(UserResponse::from).toList(),
                effectivePage, effectiveLimit, result.total());
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateUserResponse create(@Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return users.create(request, principal.user());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public UpdateUserResponse update(@PathVariable("id") String id,
            @Valid @RequestBody UpdateUserRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return users.update(id, request, principal.user());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public DeleteUserResponse delete(@PathVariable("id") String id,
            @AuthenticationPrincipal AuthUser principal) {
        return users.delete(id, principal.user());
    }

    @GetMapping("/roles")
    public RolesResponse listRoles() {
        return RolesResponse.defaults();
    }
}
