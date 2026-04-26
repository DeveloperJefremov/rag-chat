import { describe, it, expect, vi } from 'vitest';
import { IngestionService } from '../IngestionService';
import type { IDocumentRepository } from '../../repositories/IDocumentRepository';
import type { IChunkRepository } from '../../repositories/IChunkRepository';
import type { IEmbeddingClient } from '../../ports/IEmbeddingClient';
import type { IFileParser } from '../../ports/IFileParser';
import type { ChunkingService } from '../../../../domain/services/ChunkingService';

const makeRepo = () => ({
	documentRepo: {
		create: vi.fn().mockResolvedValue({
			id: 'doc-1',
			name: 'test.txt',
			fileType: 'TXT',
			chunkingStrategy: 'RECURSIVE',
			userId: 'user-1',
			createdAt: new Date(),
		}),
		deleteById: vi.fn().mockResolvedValue(undefined),
		attachToSession: vi.fn().mockResolvedValue(undefined),
	},
	chunkRepo: { saveMany: vi.fn().mockResolvedValue(undefined) },
	txtParser: {
		parse: vi.fn().mockResolvedValue('This is a test document with enough words to chunk.'),
	},
	embeddingClient: {
		embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
	},
	chunkingService: { chunk: vi.fn().mockReturnValue(['chunk one']) },
});

describe('IngestionService', () => {
	it('parses, chunks, embeds, and stores a TXT file', async () => {
		const mocks = makeRepo();
		const service = new IngestionService({
			documentRepo: mocks.documentRepo as unknown as IDocumentRepository,
			chunkRepo: mocks.chunkRepo as unknown as IChunkRepository,
			parsers: {
				TXT: mocks.txtParser as unknown as IFileParser,
				PDF: {} as unknown as IFileParser,
				DOCX: {} as unknown as IFileParser,
			},
			embeddingClient: mocks.embeddingClient as unknown as IEmbeddingClient,
			chunkingService: mocks.chunkingService as unknown as ChunkingService,
		});

		const buffer = Buffer.from('test content');
		const result = await service.ingest({
			buffer,
			fileName: 'test.txt',
			fileType: 'TXT',
			userId: 'user-1',
		});

		expect(mocks.txtParser.parse).toHaveBeenCalledWith(buffer);
		expect(mocks.chunkingService.chunk).toHaveBeenCalled();
		expect(mocks.embeddingClient.embedBatch).toHaveBeenCalledWith(['chunk one']);
		expect(mocks.chunkRepo.saveMany).toHaveBeenCalled();
		expect(mocks.documentRepo.attachToSession).not.toHaveBeenCalled();
		expect(result.documentId).toBe('doc-1');
		expect(result.chunkCount).toBe(1);
	});

	it('deletes orphaned document if chunk save fails', async () => {
		const mocks = makeRepo();
		mocks.chunkRepo.saveMany = vi.fn().mockRejectedValue(new Error('db error'));
		const service = new IngestionService({
			documentRepo: mocks.documentRepo as unknown as IDocumentRepository,
			chunkRepo: mocks.chunkRepo as unknown as IChunkRepository,
			parsers: {
				TXT: mocks.txtParser as unknown as IFileParser,
				PDF: {} as unknown as IFileParser,
				DOCX: {} as unknown as IFileParser,
			},
			embeddingClient: mocks.embeddingClient as unknown as IEmbeddingClient,
			chunkingService: mocks.chunkingService as unknown as ChunkingService,
		});

		await expect(
			service.ingest({
				buffer: Buffer.from('x'),
				fileName: 'x.txt',
				fileType: 'TXT',
				userId: 'user-1',
			}),
		).rejects.toThrow('db error');

		expect(mocks.documentRepo.deleteById).toHaveBeenCalledWith('doc-1', 'user-1');
	});

	it('attaches the new document to the given session when attachToSession is provided', async () => {
		const mocks = makeRepo();
		const service = new IngestionService({
			documentRepo: mocks.documentRepo as unknown as IDocumentRepository,
			chunkRepo: mocks.chunkRepo as unknown as IChunkRepository,
			parsers: {
				TXT: mocks.txtParser as unknown as IFileParser,
				PDF: {} as unknown as IFileParser,
				DOCX: {} as unknown as IFileParser,
			},
			embeddingClient: mocks.embeddingClient as unknown as IEmbeddingClient,
			chunkingService: mocks.chunkingService as unknown as ChunkingService,
		});

		await service.ingest({
			buffer: Buffer.from('x'),
			fileName: 'x.txt',
			fileType: 'TXT',
			userId: 'user-1',
			attachToSession: 'sess-1',
		});

		expect(mocks.documentRepo.attachToSession).toHaveBeenCalledWith('sess-1', 'doc-1');
	});
});
