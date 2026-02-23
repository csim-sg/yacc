import { IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * List Audit Logs Request
 * Query parameters for fetching audit logs with filtering
 *
 * @see GET /api/audit/logs
 * @see RBAC: manager+ (read-only access)
 */
export class ListAuditLogsRequest {
  /** Filter by actor (user who performed action) */
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Filter by action type (e.g., 'assign', 'tag', 'status_change') */
  @IsOptional()
  @IsString()
  action?: string;

  /** Filter by entity type (e.g., 'conversation', 'user', 'rule') */
  @IsOptional()
  @IsString()
  entityType?: string;

  /** Filter by specific entity UUID */
  @IsOptional()
  @IsUUID()
  entityId?: string;

  /** Date range: from (inclusive, ISO8601) */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Date range: to (inclusive, ISO8601) */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Page number (1-indexed) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Items per page (max 100) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
