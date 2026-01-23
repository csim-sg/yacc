## Task Description
Set up Cloudflare R2 storage SDK integration for storing raw payloads, attachments, and re-hosted files. This includes configuring the S3-compatible SDK, implementing signed URL generation for secure access, setting up bucket lifecycle policies for automatic cleanup, and configuring CORS for frontend uploads.

### Technical Requirements

**1. SDK Setup**
- Install `@aws-sdk/client-s3` package
- Configure S3 client with Cloudflare R2 credentials
- Create singleton service for R2 operations in `packages/backend/src/infrastructure/storage/r2.service.ts`

**2. Bucket Configuration**
- Create bucket structure:
  - `attachments/{conversationId}/` - For inbound/outbound attachments
  - `payloads/{messageId}/` - For raw platform payloads
  - `exports/{userId}/` - For CSV exports (audit logs)
- Implement bucket initialization on startup (create if not exists)
- Set up lifecycle policy:
  - Payloads: auto-delete after 7 days
  - Exports: auto-delete after 24 hours
  - Attachments: no auto-deletion (permanent storage)

**3. Signed URL Generation**
- Implement `generateUploadUrl()` for pre-signed upload URLs (valid for 15 minutes)
- Implement `generateDownloadUrl()` for pre-signed download URLs (valid for 1 hour)
- Use Cloudflare R2 SDK's `PutObjectCommand` and `GetObjectCommand`
- Support CORS headers for frontend direct uploads

**4. CORS Configuration**
- Configure R2 bucket CORS rules:
  ```
  AllowedOrigins: https://app.example.com
  AllowedMethods: PUT, GET, HEAD
  AllowedHeaders: Content-Type, Authorization
  MaxAgeSeconds: 3600
  ```

**5. Storage Operations**
- `uploadFile(key, buffer, contentType)` - Upload file buffer
- `downloadFile(key)` - Download file as buffer
- `deleteFile(key)` - Delete single file
- `deletePrefix(prefix)` - Delete all files under a prefix (for exports cleanup)
- `getFileInfo(key)` - Get file metadata

**6. Error Handling**
- Handle S3 errors with retry logic (3 attempts, exponential backoff)
- Log all storage operations with correlation IDs
- Return structured error responses: `{ code, message, details }`

### Environment Variables

```env
# Cloudflare R2 Storage
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=<your-r2-access-key-id>
CLOUDFLARE_R2_SECRET_KEY=<your-r2-secret-access-key>
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
ATTACHMENT_MAX_SIZE_MB=5
RAW_PAYLOAD_RETENTION_DAYS=7
EXPORT_RETENTION_HOURS=24
```

### File Structure

```
packages/backend/src/infrastructure/storage/
├── r2.service.ts          # Main R2 SDK wrapper
├── r2.config.ts           # R2 client initialization
└── index.ts                # Export storage interface
```

### Example Usage

```typescript
// Upload attachment
const storageKey = `attachments/${conversationId}/${uuid}_${fileName}`;
const url = await r2Service.uploadFile(storageKey, buffer, mimeType);

// Generate signed URL for frontend upload
const uploadUrl = await r2Service.generateUploadUrl(
  `uploads/${uuid}`,
  'image/jpeg',
  900 // 15 minutes in seconds
);

// Download and re-host inbound file
const buffer = await r2Service.downloadFile(existingUrl);
const newKey = `attachments/${conversationId}/${Date.now()}_${fileName}`;
const cdnUrl = await r2Service.uploadFile(newKey, buffer, mimeType);
```

### Testing Requirements

- Unit tests for all storage operations (mock S3 client)
- Integration test with real R2 bucket (use test environment)
- Test signed URL generation and expiration
- Test CORS configuration (upload from frontend)
- Test lifecycle policies (verify automatic cleanup)

## Priority
P0 - Critical - blocks Phase 1 completion or release

## Assignee
Backend

## Acceptance Criteria
- [ ] R2 SDK properly configured with environment variables
- [ ] `R2Service` class implements all required operations (upload, download, delete, signed URLs)
- [ ] Bucket initialization creates proper folder structure on startup
- [ ] Lifecycle policies configured:
  - [ ] Payloads auto-delete after 7 days
  - [ ] Exports auto-delete after 24 hours
  - [ ] Attachments have no auto-deletion
- [ ] Signed URL generation works with:
  - [ ] Upload URLs valid for 15 minutes
  - [ ] Download URLs valid for 1 hour
- [ ] CORS rules configured for frontend domain
- [ ] Error handling with retry logic implemented
- [ ] All operations logged with correlation IDs
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration test passes with test R2 bucket
- [ ] Documentation in code and README

## Status
Not Started

## Dependencies
- None (can be implemented in parallel)

## Category
Backend
