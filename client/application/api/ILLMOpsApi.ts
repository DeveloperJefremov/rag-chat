export interface LLMOpsLogEntry {
	id: string;
	query: string;
	response: string;
	latencyMs: number;
	promptTokens: number;
	completionTokens: number;
	estimatedCostUsd: number;
	chunkingStrategy: string;
	hasCitation: boolean;
	rerankingUsed: boolean;
	createdAt: string;
}

export interface LLMOpsStats {
	totalRequests: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	logs: LLMOpsLogEntry[];
}

export interface ILLMOpsApi {
	getStats(): Promise<LLMOpsStats>;
}
