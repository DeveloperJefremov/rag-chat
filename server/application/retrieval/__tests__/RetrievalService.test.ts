import { describe, it, expect, vi } from 'vitest';
import { RetrievalService, filterDocumentsByQuery } from '../RetrievalService';
import type { IChunkRepository } from '../../repositories/IChunkRepository';
import type { IDocumentRepository } from '../../repositories/IDocumentRepository';
import type { IEmbeddingClient } from '../../ports/IEmbeddingClient';
import type { ILLMClient } from '../../ports/ILLMClient';
import type { IMessageRepository } from '../../repositories/IMessageRepository';
import type { IChatSessionRepository } from '../../repositories/IChatSessionRepository';
import type { SessionService } from '../../session/SessionService';
import type { IRerankClient } from '../../ports/IRerankClient';
import type { LLMOpsService } from '../../llmops/LLMOpsService';

const makeDeps = (overrides: Partial<ConstructorParameters<typeof RetrievalService>[0]> = {}) => ({
	chunkRepo: { similaritySearch: vi.fn().mockResolvedValue([]) } as unknown as IChunkRepository,
	documentRepo: {
		findByIds: vi
			.fn()
			.mockImplementation(async (ids: string[]) => ids.map(id => ({ id, userId: 'u' }))),
	} as unknown as IDocumentRepository,
	embeddingClient: { embed: vi.fn().mockResolvedValue([0.1, 0.2]) } as unknown as IEmbeddingClient,
	llmClient: {
		streamMessage: vi.fn(),
		generateText: vi.fn().mockResolvedValue(''),
	} as unknown as ILLMClient,
	messageRepo: {
		findBySessionId: vi.fn().mockResolvedValue([]),
		saveMany: vi.fn().mockResolvedValue([]),
	} as unknown as IMessageRepository,
	chatSessionRepo: {
		findById: vi.fn().mockResolvedValue(null),
		findByUserId: vi.fn().mockResolvedValue([]),
		create: vi.fn(),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
	} as unknown as IChatSessionRepository,
	sessionService: {
		validateLimit: vi.fn().mockResolvedValue(undefined),
		incrementUsage: vi.fn().mockResolvedValue(undefined),
	} as unknown as SessionService,
	rerankClient: { rerank: vi.fn().mockResolvedValue([]) } as unknown as IRerankClient,
	llmOpsService: { log: vi.fn().mockResolvedValue(undefined) } as unknown as LLMOpsService,
	...overrides,
});

describe('RetrievalService', () => {
	describe('buildAugmentedPrompt', () => {
		it('includes context chunks and user message', () => {
			const service = new RetrievalService(makeDeps());

			const prompt = service.buildAugmentedPrompt({
				contextChunks: [
					{ content: 'Chunk A content.', documentName: 'doc-a.txt' },
					{ content: 'Chunk B content.', documentName: 'doc-b.txt' },
				],
				userMessage: 'What is in the document?',
				history: [],
			});

			expect(prompt).toContain('Chunk A content.');
			expect(prompt).toContain('Chunk B content.');
			expect(prompt).toContain('What is in the document?');
			expect(prompt).toContain('[GENERAL_KNOWLEDGE]');
		});

		it('includes chat history when provided', () => {
			const service = new RetrievalService(makeDeps());

			const prompt = service.buildAugmentedPrompt({
				contextChunks: [{ content: 'Context.', documentName: 'doc.txt' }],
				userMessage: 'Follow-up question',
				history: [
					{ role: 'USER', content: 'First question' },
					{ role: 'ASSISTANT', content: 'First answer' },
				],
			});

			expect(prompt).toContain('First question');
			expect(prompt).toContain('First answer');
		});
	});

	describe('filterDocumentsByQuery', () => {
		const names = {
			a: 'alpha guide.pdf',
			b: 'beta notes.txt',
			c: 'gamma overview.txt',
		};

		it('returns input unchanged when only one doc attached', () => {
			expect(filterDocumentsByQuery(['a'], names, 'alpha guide')).toEqual(['a']);
		});

		it('narrows to docs whose name tokens appear in the message', () => {
			const result = filterDocumentsByQuery(['a', 'b', 'c'], names, 'расскажи про alpha guide');
			expect(result).toEqual(['a']);
		});

		it('falls back to all docs when no tokens overlap', () => {
			const result = filterDocumentsByQuery(['a', 'b', 'c'], names, 'привет как дела');
			expect(result).toEqual(['a', 'b', 'c']);
		});

		it('keeps multiple docs that tie on score', () => {
			const result = filterDocumentsByQuery(
				['a', 'b', 'c'],
				{ a: 'report-q1.pdf', b: 'report-q2.pdf', c: 'unrelated.txt' },
				'покажи report пожалуйста',
			);
			expect(result.sort()).toEqual(['a', 'b']);
		});

		it('ignores configured stopwords and file extensions', () => {
			const result = filterDocumentsByQuery(
				['a', 'b'],
				{ a: 'alpha.pdf', b: 'beta.pdf' },
				'покажи документ pdf',
			);
			expect(result.sort()).toEqual(['a', 'b']);
		});
	});

	describe('stream', () => {
		const baseParams = {
			message: 'q',
			sessionId: 's',
			documentIds: ['doc-a', 'doc-b'],
			documentNames: { 'doc-a': 'A.pdf', 'doc-b': 'B.pdf' },
			userId: 'u',
			userRole: 'USER' as const,
			rerankingEnabled: false,
		};

		const chunk = (id: string, documentId: string, content = 'c') => ({
			id,
			documentId,
			content,
			score: 0.9,
		});

		const drainAsArray = async (gen: AsyncGenerator<unknown>): Promise<Array<unknown>> => {
			const out: unknown[] = [];
			for await (const ev of gen) out.push(ev);
			return out;
		};

		it('passes documentIds[] to similaritySearch', async () => {
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue([]),
			} as unknown as IChunkRepository;
			const llmClient = {
				streamMessage: async function* () {},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;
			const service = new RetrievalService(makeDeps({ chunkRepo, llmClient }));

			await drainAsArray(service.stream(baseParams));

			expect(chunkRepo.similaritySearch).toHaveBeenCalledWith(
				expect.objectContaining({ documentIds: ['doc-a', 'doc-b'], userId: 'u' }),
			);
		});

		it('yields sources first, then text chunks, with sources sliced to topK', async () => {
			const chunkRepo = {
				similaritySearch: vi
					.fn()
					.mockResolvedValue([
						chunk('1', 'doc-a', 'alpha'),
						chunk('2', 'doc-b', 'beta'),
						chunk('3', 'doc-a', 'gamma'),
					]),
			} as unknown as IChunkRepository;
			const llmClient = {
				streamMessage: async function* () {
					yield 'hello ';
					yield 'world';
				},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;

			const service = new RetrievalService(makeDeps({ chunkRepo, llmClient }));

			const events = await drainAsArray(
				service.stream({ ...baseParams, topK: 2, rerankingEnabled: false }),
			);

			expect(events[0]).toMatchObject({
				sources: expect.arrayContaining([
					expect.objectContaining({ index: 1, documentName: 'A.pdf' }),
					expect.objectContaining({ index: 2, documentName: 'B.pdf' }),
				]),
			});
			expect((events[0] as { sources: unknown[] }).sources).toHaveLength(2);
			expect(events.slice(1)).toEqual(['hello ', 'world']);
		});

		it('throws DocumentNotFound when not all documents are owned', async () => {
			const documentRepo = {
				findByIds: vi.fn().mockResolvedValue([{ id: 'doc-a', userId: 'u' }]),
			} as unknown as IDocumentRepository;
			const service = new RetrievalService(makeDeps({ documentRepo }));

			await expect(drainAsArray(service.stream(baseParams))).rejects.toThrow('document_not_found');
		});

		it('throws DocumentNotFound when a chunk leaks from a foreign document', async () => {
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue([chunk('1', 'foreign-doc', 'x')]),
			} as unknown as IChunkRepository;
			const service = new RetrievalService(makeDeps({ chunkRepo }));

			await expect(drainAsArray(service.stream(baseParams))).rejects.toThrow('document_not_found');
		});

		it('bubbles up validateLimit failure (limit_reached)', async () => {
			const sessionService = {
				validateLimit: vi.fn().mockRejectedValue(new Error('limit_reached')),
				incrementUsage: vi.fn(),
			} as unknown as SessionService;
			const service = new RetrievalService(makeDeps({ sessionService }));

			await expect(drainAsArray(service.stream(baseParams))).rejects.toThrow('limit_reached');
		});

		it('applies rerank when enabled and candidates exist', async () => {
			const candidates = [
				chunk('1', 'doc-a', 'a'),
				chunk('2', 'doc-b', 'b'),
				chunk('3', 'doc-a', 'c'),
			];
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue(candidates),
			} as unknown as IChunkRepository;
			const rerankClient = {
				rerank: vi.fn().mockResolvedValue([{ originalIndex: 2 }, { originalIndex: 0 }]),
			} as unknown as IRerankClient;
			const llmClient = {
				streamMessage: async function* () {},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;

			const service = new RetrievalService(makeDeps({ chunkRepo, rerankClient, llmClient }));
			const events = await drainAsArray(
				service.stream({ ...baseParams, rerankingEnabled: true, topK: 2 }),
			);

			expect(rerankClient.rerank).toHaveBeenCalledWith(
				expect.objectContaining({ topN: 2, query: 'q' }),
			);
			const sources = (events[0] as { sources: Array<{ content: string }> }).sources;
			expect(sources.map(s => s.content)).toEqual(['c', 'a']);
		});

		it('falls back to raw candidates when rerank throws', async () => {
			const candidates = [chunk('1', 'doc-a', 'a'), chunk('2', 'doc-b', 'b')];
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue(candidates),
			} as unknown as IChunkRepository;
			const rerankClient = {
				rerank: vi.fn().mockRejectedValue(new Error('rerank_down')),
			} as unknown as IRerankClient;
			const llmClient = {
				streamMessage: async function* () {},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;

			const service = new RetrievalService(makeDeps({ chunkRepo, rerankClient, llmClient }));
			const events = await drainAsArray(
				service.stream({ ...baseParams, rerankingEnabled: true, topK: 2 }),
			);

			const sources = (events[0] as { sources: Array<{ content: string }> }).sources;
			expect(sources.map(s => s.content)).toEqual(['a', 'b']);
		});

		it('increments usage and persists messages in finally even when LLM throws', async () => {
			const candidates = [chunk('1', 'doc-a', 'a')];
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue(candidates),
			} as unknown as IChunkRepository;
			const llmClient = {
				streamMessage: async function* () {
					yield 'partial';
					throw new Error('llm_boom');
				},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;
			const messageRepo = {
				findBySessionId: vi.fn().mockResolvedValue([]),
				saveMany: vi.fn().mockResolvedValue([]),
			} as unknown as IMessageRepository;
			const sessionService = {
				validateLimit: vi.fn().mockResolvedValue(undefined),
				incrementUsage: vi.fn().mockResolvedValue(undefined),
			} as unknown as SessionService;

			const service = new RetrievalService(
				makeDeps({ chunkRepo, llmClient, messageRepo, sessionService }),
			);

			await expect(drainAsArray(service.stream(baseParams))).rejects.toThrow('llm_boom');
			expect(sessionService.incrementUsage).toHaveBeenCalledWith('u');
			expect(messageRepo.saveMany).toHaveBeenCalledWith([
				expect.objectContaining({ role: 'USER', content: 'q', sessionId: 's' }),
				expect.objectContaining({
					role: 'ASSISTANT',
					content: 'partial',
					sessionId: 's',
					citations: expect.any(Array),
				}),
			]);
		});

		it('logs to LLMOps fire-and-forget with rerankingUsed=false when no rerank', async () => {
			const candidates = [chunk('1', 'doc-a', 'a')];
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue(candidates),
			} as unknown as IChunkRepository;
			const llmClient = {
				streamMessage: async function* () {
					yield 'ok';
				},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;
			const llmOpsService = {
				log: vi.fn().mockResolvedValue(undefined),
			} as unknown as LLMOpsService;

			const service = new RetrievalService(makeDeps({ chunkRepo, llmClient, llmOpsService }));
			await drainAsArray(service.stream({ ...baseParams, chunkingStrategy: 'FIXED' }));

			expect(llmOpsService.log).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'u',
					sessionId: 's',
					query: 'q',
					response: 'ok',
					hasCitation: true,
					rerankingUsed: false,
					chunkingStrategy: 'FIXED',
				}),
			);
		});

		it('generates a title on the first exchange and yields it', async () => {
			const llmClient = {
				streamMessage: async function* () {
					yield 'a';
				},
				generateText: vi.fn().mockResolvedValue('  "Brand new chat"  '),
			} as unknown as ILLMClient;
			const chatSessionRepo = {
				findById: vi.fn().mockResolvedValue({ id: 's', userId: 'u', title: null }),
				findByUserId: vi.fn(),
				create: vi.fn(),
				update: vi.fn().mockResolvedValue(null),
				delete: vi.fn(),
			} as unknown as IChatSessionRepository;

			const service = new RetrievalService(makeDeps({ llmClient, chatSessionRepo }));
			const events = await drainAsArray(service.stream(baseParams));

			expect(events.at(-1)).toEqual({ title: 'Brand new chat', sessionId: 's' });
			expect(chatSessionRepo.update).toHaveBeenCalledWith('s', 'u', { title: 'Brand new chat' });
		});

		it('does not generate a title when session already has one', async () => {
			const llmClient = {
				streamMessage: async function* () {
					yield 'a';
				},
				generateText: vi.fn().mockResolvedValue('Should not be used'),
			} as unknown as ILLMClient;
			const chatSessionRepo = {
				findById: vi.fn().mockResolvedValue({ id: 's', userId: 'u', title: 'Existing' }),
				findByUserId: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
			} as unknown as IChatSessionRepository;

			const service = new RetrievalService(makeDeps({ llmClient, chatSessionRepo }));
			const events = await drainAsArray(service.stream(baseParams));

			expect(events.find(e => typeof e === 'object' && e && 'title' in e)).toBeUndefined();
			expect(chatSessionRepo.update).not.toHaveBeenCalled();
		});

		it('does not generate a title when history is non-empty', async () => {
			const llmClient = {
				streamMessage: async function* () {
					yield 'a';
				},
				generateText: vi.fn().mockResolvedValue('Should not be used'),
			} as unknown as ILLMClient;
			const messageRepo = {
				findBySessionId: vi.fn().mockResolvedValue([
					{ role: 'USER', content: 'prev q' },
					{ role: 'ASSISTANT', content: 'prev a' },
				]),
				saveMany: vi.fn().mockResolvedValue([]),
			} as unknown as IMessageRepository;

			const service = new RetrievalService(makeDeps({ llmClient, messageRepo }));
			const events = await drainAsArray(service.stream(baseParams));

			expect(events.find(e => typeof e === 'object' && e && 'title' in e)).toBeUndefined();
			expect(llmClient.generateText).not.toHaveBeenCalled();
		});
	});
});
