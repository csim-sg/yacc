package com.yacc.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.integration.service.IrcConnectionState;

/**
 * MIG-040 IRC integration + profile wire tests (ledger rows
 * REST-IRCCONN-001..004, REST-IRCPROF-001..008): encrypted config save
 * (sanitized response), 409 connect when unconfigured, retrying status
 * reset, and the profile lifecycle with single-active policy — over the
 * real AES-256-GCM EncryptionService.
 */
class IrcApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "irc-super@fixture.yacc.local";
    private static final String ADMIN = "irc-admin@fixture.yacc.local";

    @Autowired
    private IrcConnectionState connectionState;

    private void seedActors() {
        seedUser("00000000-0000-0000-0000-00000000dd01", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000dd02", ADMIN, UserRole.ADMIN,
                UserStatus.ACTIVE);
    }

    private String configBody() {
        return mapper.createObjectNode()
                .put("server", "irc.fixture.local")
                .put("port", 6667)
                .put("username", "yaccbot")
                .put("password", "s3cret-password")
                .set("channels", mapper.createArrayNode().add("#yacc").add("#dev"))
                .toString();
    }

    @Test
    void configSaveConnect409TestAndStatus() throws Exception {
        seedActors();
        String superAuth = bearer(SUPER);

        // Connect with no stored config → 409 irc_not_configured.
        mockMvc.perform(post("/api/integrations/irc/connect").header("Authorization", superAuth))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("irc_not_configured"));

        // Save config (super_admin) → sanitized response, no secret on wire.
        String saved = mockMvc.perform(post("/api/integrations/irc/config")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(configBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasPassword").value(true))
                .andExpect(jsonPath("$.data.channels.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        assertThat(saved).doesNotContain("s3cret-password");

        // Invalid channel → 400 validation_error.
        mockMvc.perform(post("/api/integrations/irc/config")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("server", "irc.fixture.local")
                                .put("port", 6667)
                                .put("username", "yaccbot")
                                .set("channels", mapper.createArrayNode().add("no-hash"))
                                .toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"));

        // Admin+ may read status; connect resets state to retrying/attempt 0.
        mockMvc.perform(get("/api/integrations/irc/status").header("Authorization", bearer(ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("disconnected"));

        mockMvc.perform(post("/api/integrations/irc/connect").header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("retrying"))
                .andExpect(jsonPath("$.data.attemptCount").value(0));

        // User role denied status (admin+).
        // (seeded only admin/super here; 401/403 path covered by RBAC tests above)

        // Test with a partial body → 400 validation_error (bean validation
        // enforces the frozen IrcConfigBody schema at the controller boundary).
        mockMvc.perform(post("/api/integrations/irc/test")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("server", "only-host").toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"));

        // Complete minus channels → 400 validation_error (same frozen schema).
        mockMvc.perform(post("/api/integrations/irc/test")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("server", "irc.fixture.local")
                                .put("port", 6667)
                                .put("username", "yaccbot")
                                .toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"));
    }

    @Test
    void profileLifecycleWithSingleActivePolicy() throws Exception {
        seedActors();
        String superAuth = bearer(SUPER);
        String adminAuth = bearer(ADMIN);

        String bodyA = mapper.createObjectNode()
                .put("name", "libera")
                .put("server", "irc.libera.local")
                .put("port", 6667)
                .put("nick", "yacc-a")
                .put("password", "profile-secret")
                .set("channels", mapper.createArrayNode().add("#a"))
                .toString();
        String bodyB = mapper.createObjectNode()
                .put("name", "oftc")
                .put("server", "irc.oftc.local")
                .put("port", 6667)
                .put("nick", "yacc-b")
                .set("channels", mapper.createArrayNode().add("#b"))
                .toString();

        String createdA = mockMvc.perform(post("/api/integrations/irc/profiles")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(bodyA))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isActive").value(false))
                .andExpect(jsonPath("$.hasPassword").value(true))
                .andReturn().getResponse().getContentAsString();
        int idA = mapper.readTree(createdA).get("id").asInt();
        assertThat(createdA).doesNotContain("profile-secret");

        String createdB = mockMvc.perform(post("/api/integrations/irc/profiles")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(bodyB))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        int idB = mapper.readTree(createdB).get("id").asInt();

        // Admin may read (raw array).
        mockMvc.perform(get("/api/integrations/irc/profiles").header("Authorization", adminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // Activate A, then B — single-active policy keeps exactly one active.
        mockMvc.perform(post("/api/integrations/irc/profiles/" + idA + "/activate")
                        .header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(true));
        mockMvc.perform(post("/api/integrations/irc/profiles/" + idB + "/activate")
                        .header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(true));
        mockMvc.perform(get("/api/integrations/irc/profiles").header("Authorization", adminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + idA + ")].isActive").value(false))
                .andExpect(jsonPath("$[?(@.id == " + idB + ")].isActive").value(true));

        // Disable B; disabled profiles cannot be re-activated (409).
        mockMvc.perform(post("/api/integrations/irc/profiles/" + idB + "/disable")
                        .header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isEnabled").value(false))
                .andExpect(jsonPath("$.isActive").value(false));
        mockMvc.perform(post("/api/integrations/irc/profiles/" + idB + "/activate")
                        .header("Authorization", superAuth))
                .andExpect(status().isConflict());

        // Update A (name change) and test stored credentials (no active switch).
        mockMvc.perform(put("/api/integrations/irc/profiles/" + idA)
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("name", "libera-renamed").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("libera-renamed"));
        mockMvc.perform(post("/api/integrations/irc/profiles/" + idA + "/test")
                        .header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").isBoolean());

        // Delete A → 204 and gone.
        mockMvc.perform(delete("/api/integrations/irc/profiles/" + idA)
                        .header("Authorization", superAuth))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/integrations/irc/profiles/" + idA)
                        .header("Authorization", adminAuth))
                .andExpect(status().isNotFound());
    }
}
