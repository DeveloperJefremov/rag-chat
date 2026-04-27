import { UserRole } from '../../shared/config/limits';

export interface DeletedUserAudit {
	id: string;
	originalUserId: string;
	registeredAt: Date;
	deletedAt: Date;
	role: UserRole;
	totalQueries: number;
	totalDocuments: number;
	totalChatSessions: number;
	totalCostUsd: number;
	totalPromptTokens: number;
	totalCompletionTokens: number;
}
