import { LLMLog } from '../../../domain/entities/LLMLog';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface CreateLLMLogData {
	userId: string;
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
	chunkingStrategy: ChunkingStrategy;
}

export interface UserLLMStats {
	totalQueries: number;
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalCostUsd: number;
}

export interface ILLMLogRepository {
	create(data: CreateLLMLogData): Promise<LLMLog>;
	getRecent(limit: number): Promise<LLMLog[]>;
	aggregateByUser(userId: string): Promise<UserLLMStats>;
	anonymizeByUser(userId: string): Promise<void>;
	deleteOlderThan(cutoff: Date): Promise<number>;
}
