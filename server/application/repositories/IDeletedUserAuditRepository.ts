import { DeletedUserAudit } from '../../../domain/entities/DeletedUserAudit';
import { UserRole } from '../../../shared/config/limits';

export interface CreateDeletedUserAuditData {
	originalUserId: string;
	registeredAt: Date;
	role: UserRole;
	totalQueries: number;
	totalDocuments: number;
	totalChatSessions: number;
	totalCostUsd: number;
	totalPromptTokens: number;
	totalCompletionTokens: number;
}

export interface IDeletedUserAuditRepository {
	create(data: CreateDeletedUserAuditData): Promise<DeletedUserAudit>;
}
