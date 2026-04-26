import { ChatSession } from '../../../domain/entities/ChatSession';
import { IChatSessionRepository } from '../repositories/IChatSessionRepository';
import { IUserUsageRepository } from '../repositories/IUserUsageRepository';
import { LIMITS_BY_ROLE, UserRole } from '../../../shared/config/limits';
import { SESSION_TTL_HOURS } from '../../../shared/config/constants';

export class SessionService {
	constructor(
		private readonly chatSessionRepo: IChatSessionRepository,
		private readonly userUsageRepo: IUserUsageRepository,
	) {}

	async getOrCreate(userId: string, sessionId: string | null): Promise<ChatSession> {
		if (sessionId) {
			const existing = await this.chatSessionRepo.findById(sessionId, userId);
			if (existing && existing.expiresAt > new Date()) {
				return existing;
			}
		}
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);
		return this.chatSessionRepo.create({ userId, expiresAt });
	}

	async validateLimit(userId: string, role: UserRole): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].queriesPerDay;
		if (limit === Infinity) return;

		const todayCount = await this.userUsageRepo.getTodayCount(userId);
		if (todayCount >= limit) {
			throw new Error('limit_reached');
		}
	}

	async validateDocumentsLimit(
		_userId: string,
		role: UserRole,
		currentCount: number,
	): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].maxDocumentsPerUser;
		if (limit === Infinity) return;
		if (currentCount >= limit) throw new Error('documents_limit_reached');
	}

	async validateAttachedLimit(role: UserRole, currentCount: number): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].maxAttachedPerSession;
		if (limit === Infinity) return;
		if (currentCount >= limit) throw new Error('attached_limit_reached');
	}

	async incrementUsage(userId: string): Promise<void> {
		await this.userUsageRepo.increment(userId);
	}

	async delete(userId: string, sessionId: string): Promise<void> {
		const ok = await this.chatSessionRepo.delete(sessionId, userId);
		if (!ok) throw new Error('session_not_found');
	}
}
