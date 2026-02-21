/**
 * Users Controller
 * REST API endpoints for user management (BE-006)
 */

import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Param,
  Post,
  Put,
  QueryParam,
  BadRequestError,
} from 'routing-controllers';
import type { AuthUser } from '../types/auth.types';
import type {
  CreateUserBody,
  CreateUserResponse,
  DeleteUserResponse,
  ListUsersQuery,
  ListUsersResponse,
  ListRolesResponse,
  UpdateUserBody,
  UpdateUserResponse,
} from '../types/users.types';
import { usersService } from '../services/users.service';

/**
 * Parse and validate positive integer from query param
 * Throws BadRequestError for invalid values
 */
function parsePage(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestError('Page must be >= 1');
  }
  return n;
}

/**
 * Parse and validate limit value (must be 20, 50, or 100)
 * Throws BadRequestError for invalid values
 */
function parseLimit(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (![20, 50, 100].includes(n)) {
    throw new BadRequestError('Limit must be 20, 50, or 100');
  }
  return n;
}

/**
 * Role definitions for GET /api/roles endpoint
 */
const ROLE_DEFINITIONS = [
  {
    id: 'super_admin' as const,
    label: 'Super Admin',
    description: 'Full system access - user management, integrations, rules',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'integrations.crud',
      'rules.crud',
      'audit.read',
    ],
  },
  {
    id: 'admin' as const,
    label: 'Admin',
    description: 'Operations and inbox management',
    permissions: [
      'conversations.read',
      'conversations.update',
      'messages.send',
      'messages.reply',
      'assignments.manage',
      'tags.manage',
      'rules.read',
    ],
  },
  {
    id: 'manager' as const,
    label: 'Manager',
    description: 'Oversight and audit access',
    permissions: ['conversations.read', 'audit.read', 'analytics.read'],
  },
  {
    id: 'user' as const,
    label: 'User',
    description: 'Handle messages and conversations',
    permissions: ['conversations.read', 'messages.reply', 'assignments.view'],
  },
];

/**
 * Users Controller
 * Provides CRUD operations for user management
 * All endpoints except GET /roles require super_admin role
 */
@JsonController('/api/users')
export class UsersController {
  /**
   * GET /api/users
   * List all users with pagination and filtering
   * Super admin only
   */
  @Get('')
  @Authorized('super_admin')
  async listUsers(
    @QueryParam('page') page?: string,
    @QueryParam('limit') limit?: string,
    @QueryParam('role') role?: 'super_admin' | 'admin' | 'manager' | 'user',
    @QueryParam('status') status?: 'active' | 'inactive' | 'suspended',
    @QueryParam('search') search?: string,
    @CurrentUser() user?: AuthUser
  ): Promise<ListUsersResponse> {
    const query: ListUsersQuery = {
      page: parsePage(page),
      limit: parseLimit(limit),
      role,
      status,
      search,
    };
    return usersService.listUsers(query, user!);
  }

  /**
   * POST /api/users
   * Create a new user
   * Super admin only
   */
  @Post('')
  @Authorized('super_admin')
  @HttpCode(201)
  async createUser(
    @Body() body: CreateUserBody,
    @CurrentUser() user?: AuthUser
  ): Promise<CreateUserResponse> {
    return usersService.createUser(body, user!);
  }

  /**
   * PUT /api/users/:id
   * Update an existing user
   * Super admin only
   * Self-modification of role/status is prevented
   */
  @Put('/:id')
  @Authorized('super_admin')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
    @CurrentUser() user?: AuthUser
  ): Promise<UpdateUserResponse> {
    return usersService.updateUser(id, body, user!);
  }

  /**
   * DELETE /api/users/:id
   * Soft delete a user
   * Super admin only
   * Self-deletion is prevented
   */
  @Delete('/:id')
  @Authorized('super_admin')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser
  ): Promise<DeleteUserResponse> {
    return usersService.deleteUser(id, user!);
  }

  /**
   * GET /api/roles
   * List all available roles with their permissions
   * All authenticated users can access
   */
  @Get('/roles')
  @Authorized()
  async listRoles(): Promise<ListRolesResponse> {
    return {
      roles: ROLE_DEFINITIONS,
    };
  }
}
