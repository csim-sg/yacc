package com.yacc.common.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yacc.common.model.ServiceInfoResponse;
import com.yacc.config.YaccProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Example controller test for the MIG-010 scaffold service-info endpoint,
 * proving the deterministic {@code test} profile end to end (MIG-014): the
 * MVC slice serves {@code GET /api} from {@link YaccProperties} bound by
 * application-test.yml ({@code yacc.environment=test}).
 *
 * <p>The {@code @WebMvcTest} slice keeps this test DB-free and fast; data
 * integration tests extend {@code com.yacc.common.testsupport.AbstractPostgresIntegrationTest}
 * instead.</p>
 */
@WebMvcTest(ServiceInfoController.class)
@EnableConfigurationProperties(YaccProperties.class)
@ActiveProfiles("test")
class ServiceInfoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void servesServiceInfoFromTheDeterministicTestProfile() throws Exception {
        mockMvc.perform(get("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("yacc-backend"))
                .andExpect(jsonPath("$.environment").value("test"));
    }

    @Test
    void responsePayloadHasValueSemantics() {
        ServiceInfoResponse response = new ServiceInfoResponse("yacc-backend", "test");

        assertThat(response.name()).isEqualTo("yacc-backend");
        assertThat(response).isEqualTo(new ServiceInfoResponse("yacc-backend", "test"));
        assertThat(response).hasSameHashCodeAs(new ServiceInfoResponse("yacc-backend", "test"));
        assertThat(response).hasToString("ServiceInfoResponse[name=yacc-backend, environment=test]");
    }
}
