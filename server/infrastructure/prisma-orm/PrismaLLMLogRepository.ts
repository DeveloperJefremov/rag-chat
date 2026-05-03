import { prisma } from './prismaClient';
import { LLMLog, RetrievedChunkLog } from '../../../domain/entities/LLMLog';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateLLMLogData,
	ILLMLogRepository,
	UserLLMStats,
} from '../../application/repositories/ILLMLogRepository';

function mapLog(log: {
	id: string;
	userId: string | null;
	sessionId: string;
	documentId: string;
	query: string;
	response: string;
	latencyMs: number;
	promptTokens: number;
	completionTokens: number;
	estimatedCostUsd: number;
	hasCitation: boolean;
	rerankingUsed: boolean;
	chunkingStrategy: string;
	retrievedChunks: unknown;
	createdAt: Date;
	anonymizedAt: Date | null;
}): LLMLog {
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
		retrievedChunks: (log.retrievedChunks ?? null) as RetrievedChunkLog[] | null,
		createdAt: log.createdAt,
		anonymizedAt: log.anonymizedAt,
	};
}

export class PrismaLLMLogRepository implements ILLMLogRepository {
	async create(data: CreateLLMLogData): Promise<LLMLog> {
		const { retrievedChunks, ...rest } = data;
		const log = await prisma.lLMLog.create({
			data: {
				...rest,
				retrievedChunks: retrievedChunks ? (retrievedChunks as unknown as object[]) : undefined,
			},
		});
		return mapLog(log);
	}

	async getRecent(limit: number): Promise<LLMLog[]> {
		const logs = await prisma.lLMLog.findMany({
			orderBy: { createdAt: 'desc' },
			take: limit,
		});
		return logs.map(mapLog);
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

	async deleteOlderThan(cutoff: Date): Promise<number> {
		const result = await prisma.lLMLog.deleteMany({
			where: { createdAt: { lt: cutoff } },
		});
		return result.count;
	}
}
