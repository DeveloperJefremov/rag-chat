export interface IngestResponseDto {
	documentId: string;
	chunkCount: number;
	name: string;
	createdAt: string;
	chunkingStrategy?: string;
}
