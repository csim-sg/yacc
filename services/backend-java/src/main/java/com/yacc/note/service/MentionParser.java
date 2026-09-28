package com.yacc.note.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.yacc.auth.model.User;
import com.yacc.auth.service.UserDirectoryService;

/**
 * Mention parsing (POC {@code mention-parser.service} parity): extracts
 * {@code @username} tokens and resolves them to user ids by email
 * local-part, case-insensitively, first match wins. Silent on misses —
 * notes still post without their notifications.
 */
@Service
public class MentionParser {

    /** POC pattern: alphanumeric/underscore usernames after '@'. */
    private static final Pattern MENTION = Pattern.compile("@(\\w+)");

    private final UserDirectoryService directory;

    public MentionParser(UserDirectoryService directory) {
        this.directory = directory;
    }

    /** Extracts distinct mention tokens (without the '@'). */
    public List<String> extract(String body) {
        List<String> mentions = new ArrayList<>();
        Matcher matcher = MENTION.matcher(body);
        while (matcher.find()) {
            String mention = matcher.group(1);
            if (!mentions.contains(mention)) {
                mentions.add(mention);
            }
        }
        return mentions;
    }

    /** Resolves mention tokens to live user ids (first match per token). */
    public List<String> resolve(List<String> mentions) {
        List<String> userIds = new ArrayList<>();
        for (String mention : mentions) {
            directory.findByEmailLocalPart(mention).map(User::getId).ifPresent(userIds::add);
        }
        return userIds;
    }
}
