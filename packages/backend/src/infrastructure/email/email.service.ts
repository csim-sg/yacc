/**
 * Email Service
 * 
 * Phase 1: Console transport (logs to console)
 * Phase 2: Real SMTP (SendGrid / Nodemailer)
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  /**
   * Send password reset email
   * 
   * Phase 1: Logs to console
   * Phase 2: Uses real SMTP
   */
  async sendPasswordResetEmail(email: string, resetLink: string, token: string) {
    const subject = 'Reset Your YACC Password';
    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password for YACC.</p>
      <p>Click the link below to reset your password (valid for 1 hour):</p>
      <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p>Or copy this link:</p>
      <code>${resetLink}</code>
      <p style="color: #666; font-size: 12px;">If you didn't request this, ignore this email. Your password is safe.</p>
    `;

    const text = `
Password Reset Request

You requested to reset your password for YACC.

Click the link below to reset your password (valid for 1 hour):
${resetLink}

If you didn't request this, ignore this email. Your password is safe.
    `.trim();

    return this.send({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send email
   * 
   * Phase 1: Console transport
   * Phase 2: Real SMTP
   */
  private async send(options: EmailOptions) {
    // Phase 1: Console transport (for development/testing)
    console.log('\n📧 EMAIL SERVICE (Console Transport - Phase 1)');
    console.log('═'.repeat(60));
    console.log(`TO: ${options.to}`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log('─'.repeat(60));
    console.log('HTML BODY:');
    console.log(options.html);
    console.log('─'.repeat(60));
    if (options.text) {
      console.log('TEXT BODY:');
      console.log(options.text);
      console.log('─'.repeat(60));
    }
    console.log('═'.repeat(60));
    console.log('Note: Email logged to console (Phase 1). Real SMTP in Phase 2.\n');

    return { success: true, message: 'Email logged to console (Phase 1)' };
  }
}

export const emailService = new EmailService();
