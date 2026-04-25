import { Message, MessageRole } from '../../../domain/entities/Message';
import { CitationDto } from '../../../shared/dtos/CitationDto';

export interface SaveMessageInput {
	role: MessageRole;
	content: string;
	sessionId: string;
	citations?: CitationDto[] | null;
}

export interface IMessageRepository {
	saveMany(messages: SaveMessageInput[]): Promise<Message[]>;
	findBySessionId(sessionId: string): Promise<Message[]>;
}
