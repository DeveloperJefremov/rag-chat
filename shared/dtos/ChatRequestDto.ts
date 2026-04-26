export interface ChatRequestDto {
	message: string;
	sessionId: string;
	documentIds: string[];
	chunkingStrategy?: 'FIXED' | 'SENTENCE' | 'PARAGRAPH' | 'RECURSIVE';
	topK?: number;
	rerankingEnabled?: boolean;
}
