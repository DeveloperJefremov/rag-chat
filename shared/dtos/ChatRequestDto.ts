export interface ChatRequestDto {
	message: string;
	sessionId: string;
	documentId: string;
	chunkingStrategy?: 'FIXED' | 'SENTENCE' | 'PARAGRAPH' | 'RECURSIVE';
	topK?: number;
	rerankingEnabled?: boolean;
}
