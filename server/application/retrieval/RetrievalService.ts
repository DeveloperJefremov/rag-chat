import { IChunkRepository } from '../repositories/IChunkRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { ILLMClient } from '../ports/ILLMClient';
import { IRerankClient } from '../ports/IRerankClient';
import { SessionService } from '../session/SessionService';
import { LLMOpsService } from '../llmops/LLMOpsService';
import { MessageRole } from '../../../domain/entities/Message';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import { CitationDto } from '../../../shared/dtos/CitationDto';
import { TOP_K_CHUNKS, MAX_HISTORY_MESSAGES } from '../../../shared/config/constants';

interface RetrievalServiceDeps {
	chunkRepo: IChunkRepository;
	embeddingClient: IEmbeddingClient;
	llmClient: ILLMClient;
	messageRepo: IMessageRepository;
	sessionService: SessionService;
	rerankClient: IRerankClient;
	llmOpsService: LLMOpsService;
}

interface StreamParams {
	message: string;
	sessionId: string;
	documentId: string;
	userId: string;
	userRole: 'USER' | 'ADMIN';
	documentName: string;
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

interface BuildPromptParams {
	contextChunks: string[];
	userMessage: string;
	history: Array<{ role: MessageRole; content: string }>;
}

type StreamYield = { sources: CitationDto[] } | string;

export class RetrievalService {
	private chunkRepo: IChunkRepository;
	private embeddingClient: IEmbeddingClient;
	private llmClient: ILLMClient;
	private messageRepo: IMessageRepository;
	private sessionService: SessionService;
	private rerankClient: IRerankClient;
	private llmOpsService: LLMOpsService;

	constructor(deps: RetrievalServiceDeps) {
		this.chunkRepo = deps.chunkRepo;
		this.embeddingClient = deps.embeddingClient;
		this.llmClient = deps.llmClient;
		this.messageRepo = deps.messageRepo;
		this.sessionService = deps.sessionService;
		this.rerankClient = deps.rerankClient;
		this.llmOpsService = deps.llmOpsService;
	}

	buildAugmentedPrompt(params: BuildPromptParams): string {
		const { contextChunks, userMessage, history } = params;

		const contextSection = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n---\n');

		const historySection =
			history.length > 0
				? `\nChat history:\n${history
						.map(m => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
						.join('\n')}\n`
				: '';

		return `You are a helpful assistant. Answer questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the uploaded documents."

Context:
---
${contextSection}
---
${historySection}
Current question: ${userMessage}`;
	}

	async *stream(params: StreamParams): AsyncGenerator<StreamYield> {
		await this.sessionService.validateLimit(params.userId, params.userRole);

		const topK = params.topK ?? TOP_K_CHUNKS;
		const rerankingEnabled = params.rerankingEnabled ?? true;

		const queryVector = await this.embeddingClient.embed(params.message);

		// Fetch wide net for reranking (topK*4), then rerank down to topK
		const candidates = await this.chunkRepo.similaritySearch({
			queryVector,
			documentId: params.documentId,
			userId: params.userId,
			topK: rerankingEnabled ? topK * 4 : topK,
		});

		let reranked = candidates;
		if (rerankingEnabled && candidates.length > 0) {
			reranked = await this.rerankClient
				.rerank({
					query: params.message,
					candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
					topN: topK,
				})
				.then(results => results.map(r => candidates[r.originalIndex] ?? candidates[0]));
		}

		const sources: CitationDto[] = reranked.map((chunk, i) => ({
			index: i + 1,
			content: chunk.content.slice(0, 200),
			documentName: params.documentName,
		}));

		yield { sources };

		const allHistory = await this.messageRepo.findBySessionId(params.sessionId);
		const historyForPrompt = allHistory
			.slice(-MAX_HISTORY_MESSAGES)
			.map(m => ({ role: m.role, content: m.content }));

		const prompt = this.buildAugmentedPrompt({
			contextChunks: reranked.map(c => c.content),
			userMessage: params.message,
			history: historyForPrompt,
		});

		const startedAt = Date.now();
		let fullResponse = '';
		let promptTokens = 0;
		let completionTokens = 0;

		try {
			for await (const text of this.llmClient.streamMessage(prompt)) {
				fullResponse += text;
				completionTokens += text.split(/\s+/).length;
				yield text;
			}
		} finally {
			await this.sessionService.incrementUsage(params.userId);
			await this.messageRepo.saveMany([
				{ role: 'USER', content: params.message, sessionId: params.sessionId },
				{ role: 'ASSISTANT', content: fullResponse, sessionId: params.sessionId },
			]);

			promptTokens = prompt.split(/\s+/).length;
			const latencyMs = Date.now() - startedAt;
			const estimatedCostUsd = (promptTokens / 1e6) * 0.075 + (completionTokens / 1e6) * 0.3;

			void this.llmOpsService.log({
				userId: params.userId,
				sessionId: params.sessionId,
				documentId: params.documentId,
				query: params.message,
				response: fullResponse,
				latencyMs,
				promptTokens,
				completionTokens,
				estimatedCostUsd,
				hasCitation: sources.length > 0,
				rerankingUsed: rerankingEnabled,
				chunkingStrategy: params.chunkingStrategy ?? 'RECURSIVE',
			});
		}
	}
}
