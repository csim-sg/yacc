package com.yacc.realtime.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;

/**
 * Micrometer-backed {@link MetricsSink} (SPEC-002 TR-07; ADR-029).
 *
 * <p>Counters, histograms and timers map one-to-one onto Micrometer meters;
 * gauges use a registered {@link AtomicLong} holder per (name, tags) meter so
 * the point-in-time {@code set} semantics of the POC sink survive Micrometer's
 * pull-based gauge model. Everything is exposed through the {@code
 * /actuator/prometheus} scrape endpoint.</p>
 */
@Component
public class MicrometerMetricsSink implements MetricsSink {

    private final MeterRegistry registry;

    /** Gauge holders keyed by meter identity so gauge(name) can update in place. */
    private final Map<String, AtomicLong> gaugeHolders = new ConcurrentHashMap<>();

    public MicrometerMetricsSink(MeterRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void counter(String name, long value, Map<String, String> tags) {
        registry.counter(name, tags(tags)).increment(value);
    }

    @Override
    public void histogram(String name, double value, Map<String, String> tags) {
        DistributionSummary.builder(name).tags(tags(tags)).register(registry).record(value);
    }

    @Override
    public void gauge(String name, long value, Map<String, String> tags) {
        Iterable<Tag> meterTags = tags(tags);
        AtomicLong holder = gaugeHolders.computeIfAbsent(name + meterTags, key -> {
            AtomicLong reference = new AtomicLong(value);
            Gauge.builder(name, reference, AtomicLong::doubleValue).tags(meterTags).register(registry);
            return reference;
        });
        holder.set(value);
    }

    @Override
    public <T> T timer(String name, Supplier<T> fn, Map<String, String> tags) {
        long startNanos = System.nanoTime();
        try {
            return fn.get();
        } finally {
            histogram(name, (System.nanoTime() - startNanos) / 1_000_000.0, tags);
        }
    }

    private Iterable<Tag> tags(Map<String, String> tags) {
        return tags.entrySet().stream()
                .map(entry -> Tag.of(entry.getKey(), entry.getValue()))
                .toList();
    }
}
