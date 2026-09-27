package com.yacc.common.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.classreading.MetadataReader;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Architecture regression guard for the REST route convention (AC-MIG-040-2;
 * ARCH-004 §5; review-loop-1 finding 1 of MIG-040): {@code /api} is declared
 * at the controller {@code @RequestMapping} level — never inside method
 * mappings. Scans every {@code @RestController} in the application package
 * and fails on any violation, so the convention cannot silently regress as
 * controllers are added.
 */
class ControllerApiMappingConventionTest {

    private static final String SCAN_BASE = "com.yacc";

    @Test
    void everyRestControllerDeclaresApiAtClassLevelOnly() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> true);
        List<Class<?>> controllers = new ArrayList<>();
        var resolver = new PathMatchingResourcePatternResolver();
        var resources = resolver.getResources(
                "classpath*:com/yacc/**/*Controller.class");
        for (var resource : resources) {
            MetadataReader reader = scanner.getMetadataReaderFactory()
                    .getMetadataReader(resource);
            Class<?> type = Class.forName(reader.getClassMetadata().getClassName());
            if (AnnotatedElementUtils.hasAnnotation(type, RestController.class)) {
                controllers.add(type);
            }
        }
        assertThat(controllers).as("controllers discovered").isNotEmpty();

        List<String> violations = new ArrayList<>();
        for (Class<?> controller : controllers) {
            RequestMapping classMapping = AnnotatedElementUtils
                    .findMergedAnnotation(controller, RequestMapping.class);
            if (classMapping == null || classMapping.value().length == 0
                    || !classMapping.value()[0].startsWith("/api")) {
                violations.add(controller.getSimpleName()
                        + ": missing class-level @RequestMapping(\"/api...\")");
                continue;
            }
            for (var method : controller.getDeclaredMethods()) {
                RequestMapping methodMapping = method.getAnnotation(RequestMapping.class);
                if (methodMapping == null) {
                    continue;
                }
                for (String path : methodMapping.value()) {
                    if (path.startsWith("/api")) {
                        violations.add(controller.getSimpleName() + "#" + method.getName()
                                + ": method mapping must be relative to the controller"
                                + " prefix, found \"" + path + "\"");
                    }
                }
            }
        }
        assertThat(violations).as("guardrail violations").isEmpty();
    }
}
