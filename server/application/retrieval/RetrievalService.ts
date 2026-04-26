import { IChunkRepository } from '../repositories/IChunkRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { IChatSessionRepository } from '../repositories/IChatSessionRepository';
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
	chatSessionRepo: IChatSessionRepository;
	sessionService: SessionService;
	rerankClient: IRerankClient;
	llmOpsService: LLMOpsService;
}

interface StreamParams {
	message: string;
	sessionId: string;
	documentIds: string[];
	documentNames: Record<string, string>;
	userId: string;
	userRole: 'USER' | 'ADMIN';
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

interface BuildPromptParams {
	contextChunks: string[];
	userMessage: string;
	history: Array<{ role: MessageRole; content: string }>;
}

type StreamYield = { sources: CitationDto[] } | { title: string; sessionId: string } | string;

const TITLE_PROMPT = `Generate a concise chat title in 3-5 words for the following user question.
Reply ONLY with the title text, in the SAME language as the question, no quotes, no punctuation at the end, no prefixes like "Title:".

Question: `;

export class RetrievalService {
	private chunkRepo: IChunkRepository;
	private embeddingClient: IEmbeddingClient;
	private llmClient: ILLMClient;
	private messageRepo: IMessageRepository;
	private chatSessionRepo: IChatSessionRepository;
	private sessionService: SessionService;
	private rerankClient: IRerankClient;
	private llmOpsService: LLMOpsService;

	constructor(deps: RetrievalServiceDeps) {
		this.chunkRepo = deps.chunkRepo;
		this.embeddingClient = deps.embeddingClient;
		this.llmClient = deps.llmClient;
		this.messageRepo = deps.messageRepo;
		this.chatSessionRepo = deps.chatSessionRepo;
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

		// eslint-disable-next-line no-console
		console.log('[chat] embed query');
		const queryVector = await this.embeddingClient.embed(params.message);

		// eslint-disable-next-line no-console
		console.log('[chat] similarity search', {
			documentIds: params.documentIds,
			topK: rerankingEnabled ? topK * 4 : topK,
		});
		const candidates = await this.chunkRepo.similaritySearch({
			queryVector,
			documentIds: params.documentIds,
			userId: params.userId,
			topK: rerankingEnabled ? topK * 4 : topK,
		});
		// eslint-disable-next-line no-console
		console.log('[chat] candidates:', candidates.length);

		let reranked = candidates;
		if (rerankingEnabled && candidates.length > 0) {
			// eslint-disable-next-line no-console
			console.log('[chat] reranking');
			reranked = await this.rerankClient
				.rerank({
					query: params.message,
					candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
					topN: topK,
				})
				.then(results => results.map(r => candidates[r.originalIndex] ?? candidates[0]));
			// eslint-disable-next-line no-console
			console.log('[chat] reranked:', reranked.length);
		}

		const sources: CitationDto[] = reranked.map((chunk, i) => ({
			index: i + 1,
			content: chunk.content.slice(0, 200),
			documentName: params.documentNames[chunk.documentId] ?? 'Unknown',
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
		const isFirstExchange = allHistory.length === 0;

		try {
			// eslint-disable-next-line no-console
			console.log('[chat] starting LLM stream, prompt chars:', prompt.length);
			let chunkCount = 0;
			for await (const text of this.llmClient.streamMessage(prompt)) {
				chunkCount++;
				fullResponse += text;
				completionTokens += text.split(/\s+/).length;
				yield text;
			}
			// eslint-disable-next-line no-console
			console.log('[chat] LLM stream done, chunks:', chunkCount, 'chars:', fullResponse.length);
		} finally {
			await this.sessionService.incrementUsage(params.userId);
			await this.messageRepo.saveMany([
				{ role: 'USER', content: params.message, sessionId: params.sessionId },
				{
					role: 'ASSISTANT',
					content: fullResponse,
					sessionId: params.sessionId,
					citations: sources,
				},
			]);

			promptTokens = prompt.split(/\s+/).length;
			const latencyMs = Date.now() - startedAt;
			const estimatedCostUsd = (promptTokens / 1e6) * 0.075 + (completionTokens / 1e6) * 0.3;

			void this.llmOpsService.log({
				userId: params.userId,
				sessionId: params.sessionId,
				documentId: params.documentIds[0] ?? '',
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

		if (isFirstExchange) {
			const generated = await this.generateTitle(params.sessionId, params.userId, params.message);
			if (generated) {
				yield { title: generated, sessionId: params.sessionId };
			}
		}
	}

	private async generateTitle(
		sessionId: string,
		userId: string,
		question: string,
	): Promise<string | null> {
		try {
			const session = await this.chatSessionRepo.findById(sessionId, userId);
			if (!session || session.title) return null;

			const raw = await this.llmClient.generateText(TITLE_PROMPT + question);
			const cleaned = raw
				.trim()
				.replace(/^["'«»`]+|["'«»`]+$/g, '')
				.replace(/[.!?…]+$/g, '')
				.slice(0, 80);
			if (!cleaned) return null;

			await this.chatSessionRepo.update(sessionId, userId, { title: cleaned });
			return cleaned;
		} catch (err: unknown) {
			// eslint-disable-next-line no-console
			console.warn('[chat] title generation failed:', err);
			return null;
		}
	}
}
