import { ILLMLogRepository, CreateLLMLogData } from '../repositories/ILLMLogRepository';

export class LLMOpsService {
	constructor(private readonly logRepo: ILLMLogRepository) {}

	async log(data: CreateLLMLogData): Promise<void> {
		await this.logRepo.create(data);
	}

	async getStats(limit = 100) {
		const logs = await this.logRepo.getRecent(limit);

		const totalRequests = logs.length;
		const avgLatencyMs =
			totalRequests > 0 ? logs.reduce((s, l) => s + l.latencyMs, 0) / totalRequests : 0;

		const sorted = [...logs].sort((a, b) => a.latencyMs - b.latencyMs);
		const p95Index = Math.floor(sorted.length * 0.95);
		const p95LatencyMs = sorted[p95Index]?.latencyMs ?? 0;

		const totalCostUsd = logs.reduce((s, l) => s + l.estimatedCostUsd, 0);
		const citationRate =
			totalRequests > 0 ? logs.filter(l => l.hasCitation).length / totalRequests : 0;

		return {
			totalRequests,
			avgLatencyMs,
			p95LatencyMs,
			totalCostUsd,
			citationRate,
			logs: logs.map(l => ({
				id: l.id,
				query: l.query,
				response: l.response,
				latencyMs: l.latencyMs,
				promptTokens: l.promptTokens,
				completionTokens: l.completionTokens,
				estimatedCostUsd: l.estimatedCostUsd,
				chunkingStrategy: l.chunkingStrategy,
				hasCitation: l.hasCitation,
				rerankingUsed: l.rerankingUsed,
				createdAt: l.createdAt.toISOString(),
			})),
		};
	}
}
