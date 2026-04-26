import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface IngestParams {
	file: File;
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

export interface IIngestionApi {
	ingest(params: IngestParams): Promise<IngestResponseDto>;
	getDocuments(): Promise<IngestResponseDto[]>;
	deleteDocument(id: string): Promise<void>;
	getAttached(sessionId: string): Promise<IngestResponseDto[]>;
	attachToSession(sessionId: string, documentId: string): Promise<void>;
	detachFromSession(sessionId: string, documentId: string): Promise<void>;
}
