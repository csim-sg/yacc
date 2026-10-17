package com.yacc.api.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring-native scheduling for the MIG-051 real-time behaviors
 * (AC-MIG-051-2): the 60s {@code system.heartbeat} broadcast and the
 * expired-backlog-row sweep.
 *
 * <p>Deliberately Spring {@code @Scheduled}, not Quartz — ADR-028 assigns
 * the Quartz scheduler to MIG-063 (#360); the heartbeat and backlog sweep
 * are not queue semantics. No new infrastructure dependency.</p>
 */
@Configuration
@EnableScheduling
public class RealtimeSchedulingConfig {
}
