import { ChatSession } from '../../../domain/entities/ChatSession';
import { IChatSessionRepository } from '../repositories/IChatSessionRepository';
import { IUserUsageRepository } from '../repositories/IUserUsageRepository';
import { LIMITS_BY_ROLE, UserRole } from '../../../shared/config/limits';
import { SESSION_TTL_HOURS } from '../../../shared/config/constants';
import {
	LimitReached,
	DocumentsLimitReached,
	AttachedLimitReached,
	SessionNotFound,
} from '../../../shared/errors/AppError';

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
			throw LimitReached();
		}
	}

	async validateDocumentsLimit(
		_userId: string,
		role: UserRole,
		currentCount: number,
	): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].maxDocumentsPerUser;
		if (limit === Infinity) return;
		if (currentCount >= limit) throw DocumentsLimitReached();
	}

	async validateAttachedLimit(role: UserRole, currentCount: number): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].maxAttachedPerSession;
		if (limit === Infinity) return;
		if (currentCount >= limit) throw AttachedLimitReached();
	}

	async incrementUsage(userId: string): Promise<void> {
		await this.userUsageRepo.increment(userId);
	}

	async getRemaining(userId: string, role: UserRole): Promise<number | null> {
		const limit = LIMITS_BY_ROLE[role].queriesPerDay;
		if (limit === Infinity) return null;
		const used = await this.userUsageRepo.getTodayCount(userId);
		return Math.max(0, limit - used);
	}

	async delete(userId: string, sessionId: string): Promise<void> {
		const ok = await this.chatSessionRepo.delete(sessionId, userId);
		if (!ok) throw SessionNotFound();
	}
}
