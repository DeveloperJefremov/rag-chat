import { prisma } from './prismaClient';
import { LLMLog } from '../../../domain/entities/LLMLog';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateLLMLogData,
	ILLMLogRepository,
	UserLLMStats,
} from '../../application/repositories/ILLMLogRepository';

export class PrismaLLMLogRepository implements ILLMLogRepository {
	async create(data: CreateLLMLogData): Promise<LLMLog> {
		const log = await prisma.lLMLog.create({ data });
		return {
			id: log.id,
			userId: log.userId,
			sessionId: log.sessionId,
			documentId: log.documentId,
			query: log.query,
			response: log.response,
			latencyMs: log.latencyMs,
			promptTokens: log.promptTokens,
			completionTokens: log.completionTokens,
			estimatedCostUsd: log.estimatedCostUsd,
			hasCitation: log.hasCitation,
			rerankingUsed: log.rerankingUsed,
			chunkingStrategy: log.chunkingStrategy as ChunkingStrategy,
			createdAt: log.createdAt,
			anonymizedAt: log.anonymizedAt,
		};
	}

	async getRecent(limit: number): Promise<LLMLog[]> {
		const logs = await prisma.lLMLog.findMany({
			orderBy: { createdAt: 'desc' },
			take: limit,
		});
		return logs.map(log => ({
			id: log.id,
			userId: log.userId,
			sessionId: log.sessionId,
			documentId: log.documentId,
			query: log.query,
			response: log.response,
			latencyMs: log.latencyMs,
			promptTokens: log.promptTokens,
			completionTokens: log.completionTokens,
			estimatedCostUsd: log.estimatedCostUsd,
			hasCitation: log.hasCitation,
			rerankingUsed: log.rerankingUsed,
			chunkingStrategy: log.chunkingStrategy as ChunkingStrategy,
			createdAt: log.createdAt,
			anonymizedAt: log.anonymizedAt,
		}));
	}

	async aggregateByUser(userId: string): Promise<UserLLMStats> {
		const agg = await prisma.lLMLog.aggregate({
			where: { userId },
			_count: { _all: true },
			_sum: {
				promptTokens: true,
				completionTokens: true,
				estimatedCostUsd: true,
			},
		});
		return {
			totalQueries: agg._count._all,
			totalPromptTokens: agg._sum.promptTokens ?? 0,
			totalCompletionTokens: agg._sum.completionTokens ?? 0,
			totalCostUsd: agg._sum.estimatedCostUsd ?? 0,
		};
	}

	async anonymizeByUser(userId: string): Promise<void> {
		await prisma.lLMLog.updateMany({
			where: { userId },
			data: {
				userId: null,
				query: '',
				response: '',
				anonymizedAt: new Date(),
			},
		});
	}
}
