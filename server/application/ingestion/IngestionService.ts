import { ChunkingService } from '../../../domain/services/ChunkingService';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import { FileType } from '../../../domain/value-objects/FileType';
import { IDocumentRepository } from '../repositories/IDocumentRepository';
import { IChunkRepository } from '../repositories/IChunkRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { IFileParser } from '../ports/IFileParser';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

interface IngestParams {
	buffer: Buffer;
	fileName: string;
	fileType: FileType;
	userId: string;
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

interface IngestionServiceDeps {
	documentRepo: IDocumentRepository;
	chunkRepo: IChunkRepository;
	parsers: Record<FileType, IFileParser>;
	embeddingClient: IEmbeddingClient;
	chunkingService: ChunkingService;
}

export class IngestionService {
	private documentRepo: IDocumentRepository;
	private chunkRepo: IChunkRepository;
	private parsers: Record<FileType, IFileParser>;
	private embeddingClient: IEmbeddingClient;
	private chunkingService: ChunkingService;

	constructor(deps: IngestionServiceDeps) {
		this.documentRepo = deps.documentRepo;
		this.chunkRepo = deps.chunkRepo;
		this.parsers = deps.parsers;
		this.embeddingClient = deps.embeddingClient;
		this.chunkingService = deps.chunkingService;
	}

	async ingest(params: IngestParams): Promise<IngestResponseDto> {
		const strategy = params.chunkingStrategy ?? 'RECURSIVE';
		const parser = this.parsers[params.fileType];
		const text = await parser.parse(params.buffer);

		const chunkTexts = this.chunkingService.chunk(text, strategy);
		const embeddings = await this.embeddingClient.embedBatch(chunkTexts);

		const document = await this.documentRepo.create({
			name: params.fileName,
			fileType: params.fileType,
			chunkingStrategy: strategy,
			userId: params.userId,
		});

		try {
			await this.chunkRepo.saveMany(
				chunkTexts.map((content, i) => ({
					content,
					embedding: embeddings[i],
					documentId: document.id,
				})),
			);
		} catch (err) {
			await this.documentRepo.deleteById(document.id, params.userId).catch(() => {});
			throw err;
		}

		if (params.attachToSession) {
			await this.documentRepo.attachToSession(params.attachToSession, document.id);
		}

		return { documentId: document.id, chunkCount: chunkTexts.length, name: params.fileName };
	}
}
