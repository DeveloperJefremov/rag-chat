import { IUserRepository } from '../repositories/IUserRepository';
import { IChatSessionRepository } from '../repositories/IChatSessionRepository';
import { IDocumentRepository } from '../repositories/IDocumentRepository';
import { ILLMLogRepository } from '../repositories/ILLMLogRepository';
import { IDeletedUserAuditRepository } from '../repositories/IDeletedUserAuditRepository';

export class AccountService {
	constructor(
		private readonly userRepo: IUserRepository,
		private readonly chatSessionRepo: IChatSessionRepository,
		private readonly documentRepo: IDocumentRepository,
		private readonly llmLogRepo: ILLMLogRepository,
		private readonly deletedUserAuditRepo: IDeletedUserAuditRepository,
	) {}

	async deleteUser(userId: string): Promise<void> {
		const user = await this.userRepo.findById(userId);
		if (!user) throw new Error('user_not_found');

		const [llmStats, totalDocuments, totalChatSessions] = await Promise.all([
			this.llmLogRepo.aggregateByUser(userId),
			this.documentRepo.countByUser(userId),
			this.chatSessionRepo.countByUser(userId),
		]);

		// Audit row written first so the deletion is recorded even if a later step fails
		// and the operator has to retry. LLMLogs are anonymized (PII stripped, userId nulled)
		// so observability survives. User.delete cascades sessions/docs/chunks/messages.
		await this.deletedUserAuditRepo.create({
			originalUserId: user.id,
			registeredAt: user.createdAt,
			role: user.role,
			totalQueries: llmStats.totalQueries,
			totalDocuments,
			totalChatSessions,
			totalPromptTokens: llmStats.totalPromptTokens,
			totalCompletionTokens: llmStats.totalCompletionTokens,
			totalCostUsd: llmStats.totalCostUsd,
		});
		await this.llmLogRepo.anonymizeByUser(userId);
		await this.userRepo.deleteById(userId);
	}
}
