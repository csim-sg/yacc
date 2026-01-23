/**
 * Auth Controller
 * Handles authentication via BetterAuth with routing-controllers
 */

import { All, Controller, Req, Res } from 'routing-controllers';
import { auth } from '@yacc/backend/infrastructure/auth/better-auth';

@Controller('/api/auth')
export class AuthController {
  /**
   * Handle all BetterAuth routes
   * Routes: /sign-in/email, /sign-up/email, /sign-out, /refresh-token, etc.
   */
  @All('/*')
  async handleAuth(@Req() req: any, @Res() res: any): Promise<any> {
    // Convert Express request to BetterAuth format
    // Need full URL for Request constructor
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
    
    const request = new Request(fullUrl, {
      method: req.method,
      headers: req.headers as any,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    try {
      const response = await auth.handler(request);
      
      // Set headers
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      // Set status
      res.status(response.status);

      // Send body
      const body = await response.text();
      return res.send(body);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
}
