import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface IngestParams {
	file: File;
	sessionId: string;
	chunkingStrategy?: ChunkingStrategy;
}

export interface IIngestionApi {
	ingest(params: IngestParams): Promise<IngestResponseDto>;
}
