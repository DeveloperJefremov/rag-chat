import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

export interface LLMLog {
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
	chunkingStrategy: ChunkingStrategy;
	createdAt: Date;
	anonymizedAt: Date | null;
}
