package com.yacc.tag;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import com.yacc.tag.model.Tag;
import com.yacc.tag.repository.TagRepository;

/**
 * MIG-040 tag wire tests (ledger rows REST-TAG-001..004; GOV-021): any
 * authenticated role may create/list tags, resource-level conversation
 * access gates link/unlink, and validation rejects bad colors and tag ids.
 */
class TagApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String MEMBER = "tag-member@fixture.yacc.local";
    private static final String STRANGER = "tag-stranger@fixture.yacc.local";

    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private TagRepository tags;

    @Test
    void createListAndLinkUnlinkWithTagAccessControl() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000c001", MEMBER, UserRole.USER,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000c002", STRANGER, UserRole.USER,
                UserStatus.ACTIVE);
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.IRC, "#tags"));
        // The stranger is assigned; the member is not → member loses access.
        conversation.setAssignedUserId("00000000-0000-0000-0000-00000000c002");
        conversations.save(conversation);
        Tag tag = tags.save(new Tag("wip", "#FF5A5F", "00000000-0000-0000-0000-00000000c001"));
        String memberAuth = bearer(MEMBER);
        String strangerAuth = bearer(STRANGER);

        mockMvc.perform(get("/api/tags").header("Authorization", memberAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        mockMvc.perform(post("/api/tags").header("Authorization", memberAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("name", "new-tag").put("color", "#AA12BC").toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("new-tag"));

        mockMvc.perform(post("/api/tags").header("Authorization", memberAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("name", "bad-color").put("color", "red").toString()))
                .andExpect(status().isBadRequest());

        // Member (unassigned) may not tag the conversation → 403.
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/tags")
                        .header("Authorization", memberAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("tagId", tag.getId()).toString()))
                .andExpect(status().isForbidden());

        // Assigned stranger may link and unlink.
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/tags")
                        .header("Authorization", strangerAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("tagId", tag.getId()).toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.tags[0].name").value("wip"));

        mockMvc.perform(delete("/api/conversations/" + conversation.getId() + "/tags/"
                        + tag.getId()).header("Authorization", strangerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tags").isArray());

        // Unknown tag → 404.
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/tags")
                        .header("Authorization", strangerAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("tagId", 999999).toString()))
                .andExpect(status().isNotFound());
    }
}
