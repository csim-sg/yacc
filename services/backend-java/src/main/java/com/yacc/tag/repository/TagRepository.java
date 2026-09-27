package com.yacc.tag.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.tag.model.Tag;

/**
 * Spring Data JPA repository for {@link Tag} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface TagRepository extends JpaRepository<Tag, Integer> {

    Optional<Tag> findByNameAndCreatedById(String name, String createdById);
}
