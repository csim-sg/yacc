## Task Description
Set up Nodemailer/SendGrid email service for password reset emails and future email notifications. Configure SMTP connection, create HTML email templates, implement email verification endpoint, and create test pipeline to ensure deliverability.

### Technical Requirements

**1. Email Service Configuration**
- Install `nodemailer` package
- Create singleton service in `packages/backend/src/infrastructure/email/email.service.ts`
- Support both SMTP and SendGrid API (SendGrid preferred for production)
- Configure email pool for performance (SMTP only)

**2. Email Templates**
Create responsive HTML templates using MJML or inline CSS:

**Template: Password Reset**
- Subject: "Reset Your OmniInbox Password"
- Content:
  - Greeting with user's email
  - Reset link with token (valid for 60 minutes)
  - Security warning (link expires, ignore if not requested)
  - Support contact information
- Text fallback version for plain-text clients

**Template: Future Notifications** (Phase 2)
- Subject placeholders for different notification types
- Standard footer with unsubscribe link

**3. Verification Endpoint**
- Create test endpoint: `POST /api/_internal/test-email`
- Authentication: API key header (X-Test-Key) - admin only
- Request body:
  ```json
  {
    "to": "test@example.com",
    "template": "password_reset",
    "data": { "resetLink": "https://..." }
  }
  ```
- Response:
  ```json
  {
    "data": {
      "messageId": "msg-id-from-provider",
      "status": "sent",
      "provider": "sendgrid" | "smtp"
    }
  }
  ```
- Logs email send attempt with correlation ID

**4. Error Handling & Monitoring**
- Handle SendGrid/SMTP errors with retry logic (3 attempts, exponential backoff)
- Log all email attempts (success/failure)
- Track deliverability metrics (sent, bounced, rejected)
- Implement rate limiting (10 emails per minute per email address)

**5. Email Service Interface**

```typescript
interface IEmailService {
  sendPasswordReset(
    to: string,
    resetToken: string,
    userName?: string
  ): Promise<{ messageId: string }>;

  sendTemplate(
    to: string,
    template: string,
    data: Record<string, any>,
    subject?: string
  ): Promise<{ messageId: string }>;

  verifyConnection(): Promise<boolean>;
}
```

### Environment Variables

```env
# Email Service (choose one provider)
# Option 1: SendGrid (Recommended for Production)
SENDGRID_API_KEY=<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=OmniInbox

# Option 2: SMTP (Fallback for Development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=OmniInbox

# Email Configuration
RESET_PASSWORD_TOKEN_TTL_MINUTES=60
RESET_PASSWORD_URL=https://app.example.com/reset-password
FRONTEND_URL=https://app.example.com
```

### File Structure

```
packages/backend/src/infrastructure/email/
├── email.service.ts         # Main email service
├── templates/
│   ├── password-reset.html  # HTML template
│   └── password-reset.txt   # Plain text fallback
├── providers/
│   ├── sendgrid.provider.ts # SendGrid implementation
│   └── smtp.provider.ts     # SMTP implementation
└── index.ts                 # Export service interface
```

### Example Usage

```typescript
// Send password reset email
await emailService.sendPasswordReset(
  'user@example.com',
  'abc123-reset-token',
  'John Doe'
);

// Send custom template (future notifications)
await emailService.sendTemplate(
  'user@example.com',
  'assignment_notification',
  {
    userName: 'John',
    conversationId: 'uuid',
    conversationTitle: 'Urgent Issue'
  },
  'New Assignment: Urgent Issue'
);

// Verify connection on startup
if (!(await emailService.verifyConnection())) {
  logger.error('Email service connection failed');
}
```

### Template Example (HTML)

```html
<!DOCTYPE html>
<html>
<body>
  <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
    <h2>Password Reset Request</h2>
    <p>Hi {{userName}},</p>
    <p>We received a request to reset your password. Click the link below to reset it:</p>
    <p><a href="{{resetLink}}" style="color: #3b82f6;">Reset Password</a></p>
    <p style="color: #666; font-size: 14px;">This link will expire in 60 minutes.</p>
    <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    <hr>
    <p style="color: #999; font-size: 12px;">
      OmniInbox - {{frontendUrl}}<br>
      Questions? Contact support
    </p>
  </div>
</body>
</html>
```

### Testing Requirements

- Unit tests for email service (mock SendGrid/SMTP)
- Test template rendering with different data
- Integration test with real email provider (use test account)
- Test verification endpoint with API key
- Test rate limiting
- Test error handling (network failures, invalid emails)

### Deployment Notes

- Store SendGrid API key in VPS environment variables
- Use SendGrid sandbox for development/testing
- Configure SPF/DKIM records for production domain
- Monitor SendGrid dashboard for deliverability

## Priority
P0 - Critical - blocks Phase 1 completion or release

## Assignee
Backend

## Acceptance Criteria
- [ ] Email service properly configured with SendGrid (or SMTP fallback)
- [ ] `EmailService` implements all required methods (sendPasswordReset, sendTemplate, verifyConnection)
- [ ] HTML and plain-text email templates created:
  - [ ] Password reset template with all dynamic variables
  - [ ] Responsive design for mobile devices
  - [ ] Plain text fallback version
- [ ] Verification endpoint `/api/_internal/test-email` works:
  - [ ] Requires API key authentication
  - [ ] Sends test email successfully
  - [ ] Returns messageId and provider
- [ ] Error handling with retry logic implemented
- [ ] All email attempts logged with correlation IDs
- [ ] Rate limiting enforced (10/min per email)
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration test passes with real email provider
- [ ] Documentation includes environment variables and usage examples

## Status
Not Started

## Dependencies
- BE-026: Create environment configuration scaffolding (for env vars)

## Category
Backend
