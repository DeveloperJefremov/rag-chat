import { IChatSessionRepository } from '../repositories/IChatSessionRepository';
import { ILLMLogRepository } from '../repositories/ILLMLogRepository';
import { LLMLOG_RETENTION_DAYS } from '../../../shared/config/constants';

export interface CleanupResult {
	expiredSessions: number;
	purgedLogs: number;
	now: string;
}

export class CleanupService {
	constructor(
		private readonly chatSessionRepo: IChatSessionRepository,
		private readonly llmLogRepo: ILLMLogRepository,
	) {}

	async runAll(now: Date = new Date()): Promise<CleanupResult> {
		const expiredSessions = await this.chatSessionRepo.deleteExpired(now);

		const cutoff = new Date(now.getTime() - LLMLOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const purgedLogs = await this.llmLogRepo.deleteOlderThan(cutoff);

		return { expiredSessions, purgedLogs, now: now.toISOString() };
	}
}
