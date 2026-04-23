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

export interface ILLMLogRepository {
	create(data: CreateLLMLogData): Promise<LLMLog>;
	getRecent(limit: number): Promise<LLMLog[]>;
}
