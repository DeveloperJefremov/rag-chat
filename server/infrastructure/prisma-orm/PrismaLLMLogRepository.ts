import { prisma } from './prismaClient';
import { LLMLog } from '../../../domain/entities/LLMLog';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateLLMLogData,
	ILLMLogRepository,
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
		}));
	}
}
