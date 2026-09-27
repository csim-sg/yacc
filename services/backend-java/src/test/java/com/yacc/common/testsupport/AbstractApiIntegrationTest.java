package com.yacc.common.testsupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.AuthEmailSender;

/**
 * Shared base for MIG-040 REST-parity wire tests: real Spring Security
 * filter chain + real PostgreSQL data layer (Testcontainers), per-test
 * rollback isolation, and helpers to seed identities and mint Bearer tokens
 * through the real sign-in flow (MIG-030 conventions). The auth-email
 * transport is always mocked — no provider is contacted.
 */
@AutoConfigureMockMvc
@Transactional
public abstract class AbstractApiIntegrationTest extends AbstractPostgresIntegrationTest {

    protected static final String PASSWORD = "test-password-123";
    protected static final String BOOTSTRAP_EMAIL = "bootstrap@fixture.yacc.local";
    protected static final String BOOTSTRAP_CREDENTIAL = "bootstrap-initial-credential";

    @MockitoBean
    protected AuthEmailSender authEmailSender;

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper mapper;

    @Autowired
    protected UserRepository users;

    /**
     * Seeds a live identity with the shared fixture credential. The insert
     * is flushed immediately so FK-bearing rows seeded afterwards (audit
     * logs, conversations, messages) never out-rank the user insert in
     * Hibernate's flush order — an aborted transaction would otherwise
     * surface as a misleading sign-in failure.
     */
    protected User seedUser(String id, String email, UserRole role, UserStatus status) {
        return users.saveAndFlush(new User(id, email, "Fixture " + role.getLabel(),
                new BCryptPasswordEncoder().encode(PASSWORD), role, status, true));
    }

    /** Mints an access token through the real sign-in endpoint. */
    protected String token(String email) {
        try {
            MvcResult result = mockMvc.perform(post("/api/auth/sign-in/email")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode()
                                    .put("email", email)
                                    .put("password", PASSWORD).toString()))
                    .andReturn();
            JsonNode body = mapper.readTree(result.getResponse().getContentAsString());
            if (body == null || body.get("accessToken") == null) {
                throw new IllegalStateException("Sign-in failed for " + email
                        + ": " + result.getResponse().getContentAsString());
            }
            return body.get("accessToken").asText();
        } catch (Exception failure) {
            throw new IllegalStateException("Sign-in failed for " + email, failure);
        }
    }

    /** Authorization header value for the given identity's token. */
    protected String bearer(String email) {
        return "Bearer " + token(email);
    }
}
