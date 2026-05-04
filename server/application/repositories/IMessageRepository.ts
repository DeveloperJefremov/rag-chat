import { Message, MessageRole } from '../../../domain/entities/Message';
import { CitationDto } from '../../../shared/dtos/CitationDto';

export interface SaveMessageInput {
	role: MessageRole;
	content: string;
	sessionId: string;
	citations?: CitationDto[] | null;
}

export interface FindMessagesOptions {
	limit?: number;
	before?: Date;
}

export interface IMessageRepository {
	saveMany(messages: SaveMessageInput[]): Promise<Message[]>;
	findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]>;
	findRecentBySessionId(sessionId: string, limit: number): Promise<Message[]>;
}
