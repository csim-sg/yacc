package com.yacc.config;

import java.beans.PropertyEditorSupport;
import java.util.function.Function;

import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;

import com.yacc.entity.ConversationPriority;
import com.yacc.entity.ConversationStatus;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;

/**
 * MIG-091d-fix (contract conformance, ADR-023): web data binding for the
 * four enum filters the frozen contract types in lowercase wire labels —
 * {@code listConversations} {@code status}/{@code priority} and
 * {@code listUsers} {@code role}/{@code status} (canonicalization §1.5,
 * "lowercase on the wire").
 *
 * <p>Spring's default {@code String → Enum} binding matches Java constant
 * names ({@code OPEN}, {@code HIGH}, …) and ignores the enums'
 * {@code @JsonCreator}, so contract-valid lowercase labels were rejected
 * with 400 while it accepted the uppercase forms the contract never defined.
 * This advice binds those four types through the existing {@code fromLabel}
 * creator — exact, case-sensitive PostgreSQL labels, no duplicated mapping
 * table.</p>
 *
 * <p>The mechanism is a registered {@code PropertyEditor}, not a
 * {@code ConversionService} converter, and that choice is required for
 * strictness: when a service-level converter rejects a value,
 * {@code TypeConverterDelegate} swallows the {@code ConversionFailedException}
 * and falls back to Spring's built-in enum-constant lookup
 * ({@code attemptToConvertStringToEnum}), which would silently re-accept the
 * uppercase names — an accepted superset the frozen contract does not define.
 * A custom editor bypasses that fallback entirely: a frozen label binds
 * (200); anything else throws and surfaces as
 * {@code MethodArgumentTypeMismatchException} → 400 via the central error
 * contract. Request bodies are unaffected (Jackson honours
 * {@code @JsonCreator} and never consults this binder).</p>
 */
@ControllerAdvice
public class EnumQueryBindingConfig {

    @InitBinder
    public void registerEnumLabelEditors(WebDataBinder binder) {
        binder.registerCustomEditor(ConversationStatus.class,
                new EnumLabelEditor<>(ConversationStatus::fromLabel));
        binder.registerCustomEditor(ConversationPriority.class,
                new EnumLabelEditor<>(ConversationPriority::fromLabel));
        binder.registerCustomEditor(UserRole.class,
                new EnumLabelEditor<>(UserRole::fromLabel));
        binder.registerCustomEditor(UserStatus.class,
                new EnumLabelEditor<>(UserStatus::fromLabel));
    }

    /** Binds exactly the labels the enum's {@code fromLabel} accepts. */
    private static final class EnumLabelEditor<T> extends PropertyEditorSupport {

        private final Function<String, T> fromLabel;

        private EnumLabelEditor(Function<String, T> fromLabel) {
            this.fromLabel = fromLabel;
        }

        @Override
        public void setAsText(String text) throws IllegalArgumentException {
            setValue(fromLabel.apply(text));
        }
    }
}
