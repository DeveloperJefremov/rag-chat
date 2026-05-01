import { describe, it, expect, vi } from 'vitest';
import { RetrievalService, filterDocumentsByQuery } from '../RetrievalService';
import type { IChunkRepository } from '../../repositories/IChunkRepository';
import type { IEmbeddingClient } from '../../ports/IEmbeddingClient';
import type { ILLMClient } from '../../ports/ILLMClient';
import type { IMessageRepository } from '../../repositories/IMessageRepository';
import type { IChatSessionRepository } from '../../repositories/IChatSessionRepository';
import type { SessionService } from '../../session/SessionService';
import type { IRerankClient } from '../../ports/IRerankClient';
import type { LLMOpsService } from '../../llmops/LLMOpsService';

const makeDeps = (overrides: Partial<ConstructorParameters<typeof RetrievalService>[0]> = {}) => ({
	chunkRepo: { similaritySearch: vi.fn().mockResolvedValue([]) } as unknown as IChunkRepository,
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
			expect(prompt).toContain('answering from general knowledge');
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
		it('passes documentIds[] to similaritySearch', async () => {
			const chunkRepo = {
				similaritySearch: vi.fn().mockResolvedValue([]),
			} as unknown as IChunkRepository;
			const llmClient = {
				streamMessage: async function* () {},
				generateText: vi.fn().mockResolvedValue(''),
			} as unknown as ILLMClient;
			const service = new RetrievalService(makeDeps({ chunkRepo, llmClient }));

			const gen = service.stream({
				message: 'q',
				sessionId: 's',
				documentIds: ['doc-a', 'doc-b'],
				documentNames: { 'doc-a': 'A.pdf', 'doc-b': 'B.pdf' },
				userId: 'u',
				userRole: 'USER',
				rerankingEnabled: false,
			});
			for await (const _ of gen) {
				void _;
			}

			expect(chunkRepo.similaritySearch).toHaveBeenCalledWith(
				expect.objectContaining({ documentIds: ['doc-a', 'doc-b'], userId: 'u' }),
			);
		});
	});
});
