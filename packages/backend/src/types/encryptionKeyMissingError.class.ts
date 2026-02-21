export class EncryptionKeyMissingError extends Error {
  public readonly code = 'encryption_key_missing';

  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyMissingError';
  }
}
