package com.yacc.api.connector;

/**
 * Typed connector failure exception (POC connector "typed platform errors"
 * parity). Carries the {@link ConnectorAdapterError} that was already
 * surfaced through the {@link ConnectorErrorHook} seam, so callers receive
 * the same typed error the hook saw.
 */
public class ConnectorException extends RuntimeException {

    private final ConnectorAdapterError error;

    public ConnectorException(ConnectorAdapterError error) {
        super(error.platform() + '/' + error.operation() + ": " + error.message());
        this.error = error;
    }

    /** The typed adapter error behind this failure (hook-visible parity). */
    public ConnectorAdapterError getError() {
        return error;
    }
}
