// Placeholder for the email service client.
// In a real implementation, this would connect to an email provider like SendGrid or Nodemailer.

import { logger } from './logger';

class EmailService {
  async sendEmail(email: { to: string; subject: string; html: string }): Promise<void> {
    logger.info(
      {
        to: email.to,
        subject: email.subject,
      },
      'Sending email (placeholder)'
    );
    // In a real scenario, you would add error handling and integrate with the provider.
    return Promise.resolve();
  }
}

export const emailService = new EmailService();
