import { Document } from '@/domain/entities/Document';

export interface IngestResponseDto {
	documentId: string;
	chunkCount: number;
	name: string;
	createdAt: string;
	chunkingStrategy?: string;
}

export function toIngestResponseDto(doc: Document, chunkCount: number): IngestResponseDto {
	return {
		documentId: doc.id,
		name: doc.name,
		chunkCount,
		createdAt: doc.createdAt.toISOString(),
		chunkingStrategy: doc.chunkingStrategy,
	};
}
