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
import {
	DOC_FILTER_STOPWORDS,
	DOC_FILTER_MIN_TOKEN_LENGTH,
} from '../../../shared/config/docFilter';

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
	contextChunks: Array<{ content: string; documentName: string }>;
	userMessage: string;
	history: Array<{ role: MessageRole; content: string }>;
}

type StreamYield = { sources: CitationDto[] } | { title: string; sessionId: string } | string;

function tokenizeForFilter(s: string): string[] {
	const matches = s.toLowerCase().match(/[a-zа-яё0-9]+/giu);
	if (!matches) return [];
	return matches.filter(
		t => t.length >= DOC_FILTER_MIN_TOKEN_LENGTH && !DOC_FILTER_STOPWORDS.has(t),
	);
}

function nameTokens(name: string): string[] {
	const noExt = name.replace(/\.[^.]+$/, '');
	return tokenizeForFilter(noExt);
}

export function filterDocumentsByQuery(
	documentIds: string[],
	documentNames: Record<string, string>,
	message: string,
): string[] {
	if (documentIds.length <= 1) return documentIds;

	const queryTokens = new Set(tokenizeForFilter(message));
	if (queryTokens.size === 0) return documentIds;

	const scores = documentIds.map(id => {
		const tokens = nameTokens(documentNames[id] ?? '');
		let score = 0;
		for (const t of tokens) if (queryTokens.has(t)) score++;
		return { id, score };
	});

	const max = scores.reduce((m, s) => Math.max(m, s.score), 0);
	if (max === 0) return documentIds;
	return scores.filter(s => s.score === max).map(s => s.id);
}

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

		const contextSection = contextChunks
			.map(c => `Source: ${c.documentName}\n${c.content}`)
			.join('\n---\n');

		const historySection =
			history.length > 0
				? `\nChat history:\n${history
						.map(m => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
						.join('\n')}\n`
				: '';

		return `You are a helpful assistant with access to the user's uploaded documents.

How to answer:
1. If the answer is in the provided context, use it as the primary source. When citing, use the document's file name (e.g. "Magebit Bootcamp CV.pdf"). Do NOT use numeric references like [1], [2].
2. If the context does NOT contain the answer, you may still answer using your general knowledge. In that case, start your reply with the line "_(answering from general knowledge — not found in your documents)_" on its own line, then give the answer.
3. If you genuinely cannot answer at all (e.g. the question requires data you don't have), say so plainly.

Always reply in the same language as the user's question.

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

		const filteredDocIds = filterDocumentsByQuery(
			params.documentIds,
			params.documentNames,
			params.message,
		);
		// eslint-disable-next-line no-console
		console.log('[chat] doc filter', {
			from: params.documentIds.length,
			to: filteredDocIds.length,
			matched: filteredDocIds.map(id => params.documentNames[id]),
		});

		// eslint-disable-next-line no-console
		console.log('[chat] embed query');
		const queryVector = await this.embeddingClient.embed(params.message);

		// eslint-disable-next-line no-console
		console.log('[chat] similarity search', {
			documentIds: filteredDocIds,
			topK: rerankingEnabled ? topK * 4 : topK,
		});
		const candidates = await this.chunkRepo.similaritySearch({
			queryVector,
			documentIds: filteredDocIds,
			userId: params.userId,
			topK: rerankingEnabled ? topK * 4 : topK,
		});
		// eslint-disable-next-line no-console
		console.log('[chat] candidates:', candidates.length);

		let reranked = candidates;
		let rerankApplied = false;
		if (rerankingEnabled && candidates.length > 0) {
			// eslint-disable-next-line no-console
			console.log('[chat] reranking');
			try {
				const results = await this.rerankClient.rerank({
					query: params.message,
					candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
					topN: topK,
				});
				reranked = results.map(r => candidates[r.originalIndex] ?? candidates[0]);
				rerankApplied = true;
				// eslint-disable-next-line no-console
				console.log('[chat] reranked:', reranked.length);
			} catch (err) {
				// eslint-disable-next-line no-console
				console.warn('[chat] rerank failed, falling back to raw candidates:', err);
				reranked = candidates.slice(0, topK);
			}
		} else {
			reranked = candidates.slice(0, topK);
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
			contextChunks: reranked.map(c => ({
				content: c.content,
				documentName: params.documentNames[c.documentId] ?? 'Unknown',
			})),
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
				rerankingUsed: rerankApplied,
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
