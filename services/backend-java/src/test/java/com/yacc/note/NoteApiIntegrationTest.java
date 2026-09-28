package com.yacc.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.notification.repository.NotificationRepository;

/**
 * MIG-040 note + mention-notification wire tests (ledger rows
 * REST-NOTE-001/002): clamped pagination, mention parsing creating the
 * mention notification, and the 404 surface for unknown conversations.
 */
class NoteApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String AUTHOR = "note-author@fixture.yacc.local";
    private static final String MENTIONED = "mention@fixture.yacc.local";

    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private NotificationRepository notifications;

    private Conversation seedConversation() {
        return conversations.save(new Conversation(UUID.randomUUID(), ChannelType.IRC, "#notes"));
    }

    @Test
    void createNoteParsesMentionsAndListsPaginated() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000b001", AUTHOR, UserRole.USER,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000b002", MENTIONED, UserRole.USER,
                UserStatus.ACTIVE);
        Conversation conversation = seedConversation();
        String auth = bearer(AUTHOR);

        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/notes")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("body", "ping @mention please").toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.body").value("ping @mention please"));

        assertThat(notifications.findByUserId("00000000-0000-0000-0000-00000000b002"))
                .anySatisfy(notification -> {
                    assertThat(notification.getType()).isEqualTo("mention");
                    assertThat(notification.getConversationId()).isEqualTo(conversation.getId());
                });

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/notes")
                            .header("Authorization", auth)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode().put("body", "note " + i).toString()))
                    .andExpect(status().isCreated());
        }

        mockMvc.perform(get("/api/conversations/" + conversation.getId() + "/notes")
                        .header("Authorization", auth).param("pageSize", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.limit").value(2))
                .andExpect(jsonPath("$.total").value(4));

        mockMvc.perform(post("/api/conversations/" + UUID.randomUUID() + "/notes")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "ghost").toString()))
                .andExpect(status().isNotFound());
    }
}
