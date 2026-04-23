export interface IngestResponseDto {
	documentId: string;
	chunkCount: number;
	name: string;
	chunkingStrategy?: string;
}
