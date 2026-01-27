import {
  JsonController,
  Post,
  Get,
  Delete,
  Param,
  Body,
  BadRequestError,
} from 'routing-controllers';
import { RequireRole } from '../decorators/requireRole.decorator';
import type { AuthUser } from '../types/auth.types';

/**
 * Users Controller
 * 
 * Manages user creation, listing, and deletion operations.
 * Requires specific roles for each operation.
 * 
 * @see .docs/plans/week1-product-owner-review.md (Section 3.3: Permission Matrix)
 */
@JsonController('/api/users')
export class UsersController {
  /**
   * Create a new user (Super Admin only)
   * 
   * @param dto - Create user data (email, password, name, role)
   * @param user - Authenticated user (verified to be super_admin via decorator)
   * @returns Created user object
   */
  @Post('/')
  async createUser(
    @Body() dto: CreateUserDto,
    @RequireRole('super_admin') user: AuthUser
  ) {
    // Validate input
    if (!dto.email || !dto.password || !dto.name) {
      throw new BadRequestError(
        'Email, password, and name are required'
      );
    }

    // TODO: Implement actual user creation with database
    // For now, return mock response for testing
    return {
      id: 'mock-user-id-' + Date.now(),
      email: dto.email,
      name: dto.name,
      role: dto.role || 'user',
      status: 'active',
      emailVerified: false,
      createdAt: new Date(),
    };
  }

  /**
   * List all users (Admin and Super Admin only)
   * 
   * @param user - Authenticated user (verified to be admin+ via decorator)
   * @returns Array of user objects
   */
  @Get('/')
  async listUsers(@RequireRole(['super_admin', 'admin']) user: AuthUser) {
    // TODO: Implement actual user listing from database
    // For now, return mock response for testing
    return [
      {
        id: 'user-1',
        email: 'super@test.com',
        name: 'Super Admin',
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
      },
    ];
  }

  /**
   * Get user by ID (Admin and Super Admin only)
   * 
   * @param user - Authenticated user (verified to be admin+ via decorator)
   * @param id - User ID to retrieve
   * @returns User object
   */
  @Get('/:id')
  async getUser(
    @RequireRole(['super_admin', 'admin']) user: AuthUser,
    @Param('id') id: string
  ) {
    // TODO: Implement actual user retrieval from database
    if (!id) {
      throw new BadRequestError('User ID is required');
    }

    // Mock response for testing
    return {
      id,
      email: 'user@test.com',
      name: 'User Name',
      role: 'user',
      status: 'active',
      emailVerified: false,
      createdAt: new Date(),
    };
  }

  /**
   * Delete user (Super Admin only)
   * 
   * @param user - Authenticated user (verified to be super_admin via decorator)
   * @param id - User ID to delete
   * @returns Success message
   */
  @Delete('/:id')
  async deleteUser(
    @RequireRole('super_admin') user: AuthUser,
    @Param('id') id: string
  ) {
    if (!id) {
      throw new BadRequestError('User ID is required');
    }

    // TODO: Implement actual user deletion from database
    // For now, return mock response for testing
    return {
      success: true,
      message: `User ${id} deleted successfully`,
    };
  }
}

/**
 * Create User DTO
 */
interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role?: 'super_admin' | 'admin' | 'manager' | 'user';
}
