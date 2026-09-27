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

    // MIG-014 test infrastructure (SPEC-002 Testing Strategy; ARCH-004 §13 #10).
    // Versions are managed by the Spring Boot dependency-management BOM.
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    // Test-only data-layer harness (JdbcTemplate); the real data access stack
    // (Flyway + Spring Data JPA) arrives with MIG-020/021.
    testImplementation("org.springframework.boot:spring-boot-starter-jdbc")
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
