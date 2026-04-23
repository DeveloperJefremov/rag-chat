import { CitationDto } from '../../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface StreamChatParams {
	message: string;
	sessionId: string;
	documentId: string;
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

export type ChatStreamEvent =
	| { type: 'sources'; sources: CitationDto[] }
	| { type: 'chunk'; text: string }
	| { type: 'error'; error: string }
	| { type: 'done' };

export interface IChatApi {
	streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent>;
}
