package com.yacc.conversation.model;

/**
 * Conversation participant derived from inbound message senders (POC
 * parity: {@code {id, name, type: 'contact'}} where id equals the sender
 * display name).
 */
public record Participant(String id, String name, String type) {

    public static Participant contact(String senderName) {
        return new Participant(senderName, senderName, "contact");
    }
}
