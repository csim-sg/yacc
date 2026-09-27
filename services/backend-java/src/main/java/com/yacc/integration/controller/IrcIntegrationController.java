package com.yacc.integration.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.auth.model.AuthUser;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.common.controller.IntegrationApiException;
import com.yacc.common.model.IntegrationErrorResponse;
import com.yacc.integration.model.IrcConfigRequest;
import com.yacc.integration.model.IrcConfigResponse;
import com.yacc.integration.model.IrcConnectionStatus;
import com.yacc.integration.model.IrcTestRequest;
import com.yacc.integration.service.IrcConfigService;

import jakarta.validation.Valid;

/**
 * IRC integration wire surface (ledger rows REST-IRCCONN-001..004; frozen
 * contract ops {@code saveIrcConfig}, {@code connectIrc}, {@code testIrcConnection},
 * {@code getIrcStatus}): super_admin for config/connect/test, admin+ for
 * status. Errors use the frozen {@code {code,message}} shape.
 */
@RestController
@RequestMapping("/api/integrations/irc")
public class IrcIntegrationController {

    private final IrcConfigService irc;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public IrcIntegrationController(IrcConfigService irc, AuditPersistence audit,
            ObjectMapper mapper) {
        this.irc = irc;
        this.audit = audit;
        this.mapper = mapper;
    }

    @PostMapping("/config")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public IrcConfigEnvelope saveConfig(@Valid @RequestBody IrcConfigRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        IrcConfigResponse saved = irc.saveConfig(principal.getId(), request);
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("server", request.server());
        metadata.put("port", request.port());
        metadata.put("username", request.username());
        metadata.set("channels", mapper.valueToTree(request.channels()));
        metadata.put("passwordChanged", request.password() != null && !request.password().isBlank());
        audit.persist(new AuditRecord("integration.irc.config_updated", "integration", "irc",
                principal.getId(), metadata, null));
        return new IrcConfigEnvelope(saved);
    }

    @PostMapping("/connect")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public IrcStatusEnvelope connect(@AuthenticationPrincipal AuthUser principal) {
        var config = irc.prepareConnect();
        if (config.isEmpty()) {
            audit.persist(new AuditRecord("integration.irc.connect_requested", "integration",
                    "irc", principal.getId(), metadata("source", "none"), null));
            throw new IntegrationApiException(IntegrationErrorResponse.IRC_NOT_CONFIGURED, 409,
                    "IRC is not configured. Save configuration first.");
        }
        IrcConnectionStatus status = irc.status();
        audit.persist(new AuditRecord("integration.irc.connect_requested", "integration",
                "irc", principal.getId(),
                metadata("source", config.get().source()), null));
        return new IrcStatusEnvelope(status);
    }

    @PostMapping("/test")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public IrcTestEnvelope test(
            @Valid @RequestBody(required = false) IrcTestRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        IrcConfigService.TestResult result = irc.test(request);
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("source", result.source());
        metadata.put("success", result.success());
        audit.persist(new AuditRecord("integration.irc.test_requested", "integration", "irc",
                principal.getId(), metadata, null));
        return new IrcTestEnvelope(new SanitizedResult(result.success(), result.message()));
    }

    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public IrcStatusEnvelope status() {
        return new IrcStatusEnvelope(irc.status());
    }

    private ObjectNode metadata(String key, String value) {
        ObjectNode node = mapper.createObjectNode();
        node.put(key, value);
        return node;
    }

    /**
     * Saved-config envelope {@code {data: {...}}}.
     *
     * @param data sanitized saved config
     */
    public record IrcConfigEnvelope(IrcConfigResponse data) {
    }

    /**
     * Status envelope {@code {data: IrcConnectionStatus}}.
     *
     * @param data connection status
     */
    public record IrcStatusEnvelope(IrcConnectionStatus data) {
    }

    /**
     * Test envelope {@code {data: {success,message}}} (sanitized).
     *
     * @param data sanitized test result
     */
    public record IrcTestEnvelope(SanitizedResult data) {
    }

    /**
     * Sanitized test result.
     *
     * @param success connection established
     * @param message human-readable outcome
     */
    public record SanitizedResult(boolean success, String message) {
    }
}
