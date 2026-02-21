/**
 * Users Service
 * Business logic for user CRUD operations (BE-006)
 */

import * as bcrypt from 'bcryptjs';
import { and, count, eq, ilike, isNull, ne, SQL } from 'drizzle-orm';
import { sign } from 'jsonwebtoken';
import { BadRequestError, ForbiddenError, NotFoundError } from 'routing-controllers';
import { appConfig } from '../config/appConfig';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { users } from '../schemas/user.schema';
import type { AuthUser } from '../types/auth.types';
import { ConflictError } from '../types/httpErrors.type';
import type {
  CreateUserBody,
  CreateUserResponse,
  DeleteUserResponse,
  ListUsersQuery,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserResponse,
  UserChanges,
  UserResponse,
} from '../types/users.types';
import { auditService } from './audit.service';

/**
 * Valid limit values for pagination
 */
const VALID_LIMITS = [20, 50, 100] as const;
type ValidLimit = (typeof VALID_LIMITS)[number];

/**
 * Users Service
 * Handles all user management business logic
 */
export class UsersService {
  /**
   * List users with pagination and filtering
   * Excludes soft-deleted users by default
   */
  async listUsers(
    query: ListUsersQuery,
    actor: AuthUser,
    correlationId?: string
  ): Promise<ListUsersResponse> {
    const { page = 1, limit = 20, role, status, search } = query;

    // Validate pagination
    if (page < 1) {
      throw new BadRequestError('Page must be >= 1');
    }
    if (!VALID_LIMITS.includes(limit as ValidLimit)) {
      throw new BadRequestError('Limit must be 20, 50, or 100');
    }

    // Validate role filter
    if (role && !['super_admin', 'admin', 'manager', 'user'].includes(role)) {
      throw new BadRequestError('Invalid role value');
    }

    // Validate status filter
    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    try {
      // Build where conditions
      const conditions: SQL[] = [isNull(users.deletedAt)];

      if (role) {
        conditions.push(eq(users.role, role));
      }

      if (status) {
        conditions.push(eq(users.status, status));
      }

      if (search) {
        conditions.push(ilike(users.email, `%${search}%`));
      }

      const whereClause = and(...conditions);

      // Get total count
      const countResult = await dbClient
        .select({ count: count() })
        .from(users)
        .where(whereClause);
      const total = countResult[0]?.count ?? 0;

      // Get paginated users
      const offset = (page - 1) * limit;
      const usersList = await dbClient
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt);

      // Log audit action
      await auditService.logAction({
        actorId: actor.id,
        action: 'users.list',
        entityType: 'user',
        entityId: 'list',
        metadata: { page, limit, role, status, search, resultCount: usersList.length },
        correlationId,
      });

      return {
        users: usersList.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          deletedAt: u.deletedAt,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error(
        { error: error instanceof Error ? error.message : String(error), correlationId },
        'Failed to list users'
      );
      throw new Error('Failed to list users');
    }
  }

  /**
   * Create a new user
   */
  async createUser(
    body: CreateUserBody,
    actor: AuthUser,
    correlationId?: string
  ): Promise<CreateUserResponse> {
    const { email, password, name, role } = body;

    // Validate email
    if (!email || email.trim().length === 0) {
      throw new BadRequestError('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('Invalid email format');
    }

    if (email.length > 255) {
      throw new BadRequestError('Email too long (max 255 chars)');
    }

    // Validate password
    if (!password || password.length === 0) {
      throw new BadRequestError('Password is required');
    }

    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new BadRequestError('Name is required');
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'manager', 'user'];
    if (!role || !validRoles.includes(role)) {
      throw new BadRequestError('Invalid role (must be super_admin, admin, manager, or user)');
    }

    try {
      // Check if email already exists (case-insensitive)
      const existingUser = await dbClient
        .select()
        .from(users)
        .where(ilike(users.email, email))
        .limit(1);

      if (existingUser.length > 0 && !existingUser[0].deletedAt) {
        throw new ConflictError('Email already registered');
      }

      // Hash password using bcrypt (compatible with existing password reset flow)
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate user ID
      const userId = this.generateUserId();

      // Insert user
      const now = new Date();
      await dbClient.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        name,
        passwordHash,
        role,
        status: 'active',
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      // Fetch created user
      const createdUser = await dbClient
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!createdUser[0]) {
        throw new Error('Failed to create user');
      }

      // Log audit action
      await auditService.logAction({
        actorId: actor.id,
        action: 'users.created',
        entityType: 'user',
        entityId: userId,
        metadata: {
          createdUserId: userId,
          email: email.toLowerCase(),
          role,
          createdBy: actor.email,
        },
        correlationId,
      });

      logger.info(
        { userId, email, role, actorId: actor.id, correlationId },
        'User created successfully'
      );

      return {
        id: userId,
        email: createdUser[0].email,
        name: createdUser[0].name,
        role: createdUser[0].role,
        status: createdUser[0].status,
        createdAt: createdUser[0].createdAt,
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof ConflictError) {
        throw error;
      }
      logger.error(
        { error: error instanceof Error ? error.message : String(error), correlationId },
        'Failed to create user'
      );
      throw new Error('Failed to create user');
    }
  }

  /**
   * Update a user
   */
  async updateUser(
    userId: string,
    body: UpdateUserBody,
    actor: AuthUser,
    correlationId?: string
  ): Promise<UpdateUserResponse> {
    // Check for self-modification prevention
    if (actor.id === userId && (body.role || body.status)) {
      throw new ForbiddenError('Cannot modify your own role or status');
    }

    // Validate role if provided
    if (body.role && !['super_admin', 'admin', 'manager', 'user'].includes(body.role)) {
      throw new BadRequestError('Invalid role');
    }

    // Validate status if provided
    if (body.status && !['active', 'inactive', 'suspended'].includes(body.status)) {
      throw new BadRequestError('Invalid status (must be active, inactive, or suspended)');
    }

    // Validate email if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        throw new BadRequestError('Invalid email format');
      }
      if (body.email.length > 255) {
        throw new BadRequestError('Email too long (max 255 chars)');
      }
    }

    try {
      // Fetch existing user
      const existingUser = await dbClient
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser[0]) {
        throw new NotFoundError('User not found');
      }

      const user = existingUser[0];

      // Check email uniqueness if changing
      if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
        const emailExists = await dbClient
          .select()
          .from(users)
          .where(and(ilike(users.email, body.email), ne(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (emailExists.length > 0) {
          throw new ConflictError('Email already in use');
        }
      }

      // Track changes for audit
      const changes: UserChanges = {};
      if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
        changes.email = { from: user.email, to: body.email.toLowerCase() };
      }
      if (body.name && body.name !== user.name) {
        changes.name = { from: user.name, to: body.name };
      }
      if (body.role && body.role !== user.role) {
        changes.role = { from: user.role, to: body.role };
      }
      if (body.status && body.status !== user.status) {
        changes.status = { from: user.status, to: body.status };
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (body.email) {
        updateData.email = body.email.toLowerCase();
      }
      if (body.name) {
        updateData.name = body.name;
      }
      if (body.role) {
        updateData.role = body.role;
      }
      if (body.status) {
        updateData.status = body.status;
      }

      // Update user
      await dbClient.update(users).set(updateData).where(eq(users.id, userId));

      // Fetch updated user
      const updatedUser = await dbClient
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!updatedUser[0]) {
        throw new Error('Failed to fetch updated user');
      }

      // Log audit action
      await auditService.logAction({
        actorId: actor.id,
        action: 'users.updated',
        entityType: 'user',
        entityId: userId,
        metadata: {
          userId,
          changes,
          updatedBy: actor.email,
        },
        correlationId,
      });

      logger.info(
        { userId, changes, actorId: actor.id, correlationId },
        'User updated successfully'
      );

      return {
        id: userId,
        email: updatedUser[0].email,
        name: updatedUser[0].name,
        role: updatedUser[0].role,
        status: updatedUser[0].status,
        updatedAt: updatedUser[0].updatedAt,
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof ConflictError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      logger.error(
        { error: error instanceof Error ? error.message : String(error), correlationId },
        'Failed to update user'
      );
      throw new Error('Failed to update user');
    }
  }

  /**
   * Soft delete a user
   */
  async deleteUser(
    userId: string,
    actor: AuthUser,
    correlationId?: string
  ): Promise<DeleteUserResponse> {
    // Check for self-deletion prevention
    if (actor.id === userId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    try {
      // Fetch existing user
      const existingUser = await dbClient
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser[0]) {
        throw new NotFoundError('User not found');
      }

      const user = existingUser[0];

      // Check if already soft-deleted (idempotent)
      if (user.deletedAt) {
        return {
          id: userId,
          deletedAt: user.deletedAt,
        };
      }

      // Soft delete user
      const deletedAt = new Date();
      await dbClient.update(users).set({ deletedAt, updatedAt: deletedAt }).where(eq(users.id, userId));

      // Log audit action
      await auditService.logAction({
        actorId: actor.id,
        action: 'users.deleted',
        entityType: 'user',
        entityId: userId,
        metadata: {
          userId,
          email: user.email,
          deletedBy: actor.email,
          reason: 'Manual deletion by admin',
        },
        correlationId,
      });

      logger.info(
        { userId, email: user.email, actorId: actor.id, correlationId },
        'User soft-deleted successfully'
      );

      return {
        id: userId,
        deletedAt,
      };
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error(
        { error: error instanceof Error ? error.message : String(error), correlationId },
        'Failed to delete user'
      );
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    try {
      const user = await dbClient
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user[0]) {
        return null;
      }

      return {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        role: user[0].role,
        status: user[0].status,
        createdAt: user[0].createdAt,
        updatedAt: user[0].updatedAt,
        deletedAt: user[0].deletedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique user ID (BetterAuth-compatible format)
   */
  private generateUserId(): string {
    // Generate a JWT-style ID similar to BetterAuth
    const payload = {
      sub: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
    };
    return sign(payload, appConfig.BETTER_AUTH_SECRET, { noTimestamp: true });
  }
}

/**
 * Singleton export for use in controllers
 */
export const usersService = new UsersService();
