import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

export interface RetrievedChunkLog {
	chunkId: string;
	documentId: string;
	similarity: number;
	rerankScore?: number;
	rank: number;
}

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
	retrievedChunks: RetrievedChunkLog[] | null;
	createdAt: Date;
	anonymizedAt: Date | null;
}
