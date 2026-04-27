import { prisma } from './prismaClient';
import { DeletedUserAudit } from '../../../domain/entities/DeletedUserAudit';
import { UserRole } from '../../../shared/config/limits';
import {
	CreateDeletedUserAuditData,
	IDeletedUserAuditRepository,
} from '../../application/repositories/IDeletedUserAuditRepository';

export class PrismaDeletedUserAuditRepository implements IDeletedUserAuditRepository {
	async create(data: CreateDeletedUserAuditData): Promise<DeletedUserAudit> {
		const row = await prisma.deletedUserAudit.create({ data });
		return {
			id: row.id,
			originalUserId: row.originalUserId,
			registeredAt: row.registeredAt,
			deletedAt: row.deletedAt,
			role: row.role as UserRole,
			totalQueries: row.totalQueries,
			totalDocuments: row.totalDocuments,
			totalChatSessions: row.totalChatSessions,
			totalCostUsd: row.totalCostUsd,
			totalPromptTokens: row.totalPromptTokens,
			totalCompletionTokens: row.totalCompletionTokens,
		};
	}
}
