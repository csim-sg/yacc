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

    // --- MIG-030 auth/identity (SPEC-002 FR-04, TR-05; ADR-025) ---
    // Spring Security filter chain + JWT resource server (inbound Bearer JWT).
    // Brings spring-security-config/web and the Nimbus JOSE stack used by the
    // stateless access-token encoder/decoder. No bespoke token crypto: signing
    // keys are standard RS256 (RSA) material via @ConfigurationProperties; the
    // same asymmetric key family is the foundation the embedded OIDC
    // authorization server (MIG-033) and the relying party (MIG-032) build on.
    // The Spring Authorization Server dependency itself is MIG-033 scope.
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    // --- MIG-032 OIDC relying party (SPEC-002 FR-04/TR-05; ADR-025) ---
    // oauth2Login filter-chain segment + OIDC client-registration support for
    // external IdP login with explicit account linking. No bespoke token
    // crypto: ID-token signature/issuer/audience validation is Spring
    // Security's standard JwtDecoder/OidcIdTokenValidator path. The provider/
    // client registration is config-driven (typed yacc.auth.oauth2.*
    // @ConfigurationProperties — ARCH-004 §4); no hard-coded IdP. The embedded
    // OIDC authorization server (AS) remains MIG-033 scope.
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    // --- MIG-033 OIDC authorization server (SPEC-002 FR-04/TR-05; ADR-025) ---
    // Embedded Spring Authorization Server (the founder-fixed dual-role OIDC
    // AS; no Keycloak/broker — ADR-025). Brings the framework-standard
    // authorization/token/JWKS/revocation/OIDC-discovery endpoints; the only
    // approved dependency addition of MIG-033. Signing keys come from the
    // SAME RS256 key family as the resource server (yacc.auth.token.*,
    // MIG-030) — one token format, one signing-key source; no bespoke token
    // crypto. The AS filter chain and registered-client policy live in
    // auth/AuthorizationServerConfig (yacc.auth.as.* config binding).
    implementation("org.springframework.boot:spring-boot-starter-oauth2-authorization-server")
    // Bean validation (@Valid + jakarta.validation constraints) on inbound
    // request bodies — the replacement for the POC's Zod validation
    // (ARCH-004 §3; ADR-023 supersedes ADR-020).
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // --- MIG-031 auth email (SPEC-002 integration table: Email SMTP/SendGrid) ---
    // SMTP transport for password-reset + email-verification messages via
    // spring.mail.* binding; the provider adapter (SMTP default, SendGrid)
    // is selected by AuthEmailConfig from yacc.auth.email.*. Send failures
    // retry + audit; tests always mock the transport (never a real provider).
    implementation("org.springframework.boot:spring-boot-starter-mail")

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
    testImplementation("org.springframework.security:spring-security-test")
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
