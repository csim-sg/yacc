plugins {
    java
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
    jacoco
}

group = "com.yacc"
version = "0.1.0-SNAPSHOT"
description = "YACC Java/Spring backend (SPEC-002 MIG-010 scaffold)"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // --- MIG-011 observability (SPEC-002 TR-07, ADR-029) ---
    // Micrometer Prometheus registry: /actuator/prometheus scrape endpoint.
    implementation("io.micrometer:micrometer-registry-prometheus")
    // Spring Security event API only (audit listener). The filter chain and
    // identity subsystem are MIG-030; no security auto-configuration is used.
    implementation("org.springframework.security:spring-security-core")

    // --- MIG-020 data foundation (SPEC-002 FR-03; ADR-027) ---
    // Flyway is the only schema-change mechanism (ARCH-004 §7); the
    // database-specific module is required from Flyway 10 onward.
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // --- MIG-021 data access layer (SPEC-002 FR-03; ADR-027/030) ---
    // Spring Data JPA repositories/entities. Schema changes stay Flyway-only
    // (ARCH-004 §7); Hibernate runs with ddl-auto=none (validate in tests).
    // Brings spring-boot-starter-jdbc (DataSource + JdbcTemplate for Flyway)
    // transitively — no separate JDBC starter declaration.
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    // MIG-014 test infrastructure (SPEC-002 Testing Strategy; ARCH-004 §13 #10).
    // Versions are managed by the Spring Boot dependency-management BOM.
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("org.postgresql:postgresql")
}

tasks.test {
    useJUnitPlatform()
    // Every test run also produces the JaCoCo report used as coverage evidence.
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    reports {
        xml.required = true // machine-readable evidence linked from the issue/PR
        html.required = true // human-readable report under build/reports/jacoco
    }
    classDirectories.setFrom(
        sourceSets.main.get().output.asFileTree.matching {
            exclude("com/yacc/YaccApplication*")
        }
    )
}

// Coverage gate (SPEC-002 Testing Strategy; ARCH-004 §14 #9): >=85% instruction
// coverage for the module, enforced as part of `./gradlew check`.
//
// Exclusion: com.yacc.YaccApplication is the bootstrap entrypoint
// (infrastructure). Covering main() would require booting a second Spring
// context from inside the test JVM; every other class in the module counts
// toward the gate.
tasks.jacocoTestCoverageVerification {
    classDirectories.setFrom(
        sourceSets.main.get().output.asFileTree.matching {
            exclude("com/yacc/YaccApplication*")
        }
    )
    violationRules {
        rule {
            limit {
                counter = "INSTRUCTION"
                value = "COVEREDRATIO"
                minimum = 0.85.toBigDecimal()
            }
        }
    }
}

tasks.named("check") {
    dependsOn(tasks.jacocoTestCoverageVerification)
}

// MIG-013 contract-test gate (AC-MIG-013-2; SPEC-002 Testing Strategy):
// contract tests carry @Tag("contract") and run via this dedicated task so
// OpenAPI/AsyncAPI conformance (ADR-023) is a named CI gate alongside the
// coverage gate above. The first contract tests land with MIG-041, which also
// owns the final test/contract split and JaCoCo execution-data wiring; until
// then the task tolerates zero matching tests so CI stays green.
tasks.register<Test>("contractTest") {
    group = "verification"
    description = "Runs contract tests (JUnit @Tag(\"contract\")) — tests land with MIG-041."
    testClassesDirs = sourceSets.getByName("test").output.classesDirs
    classpath = sourceSets.getByName("test").runtimeClasspath
    useJUnitPlatform {
        includeTags("contract")
    }
    filter {
        isFailOnNoMatchingTests = false
    }
}
